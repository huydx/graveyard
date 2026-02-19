"""Source and concept endpoints."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from backend_py.api.deps import StoreDep
from backend_py.config import get_settings
from backend_py.db import SourceNotFoundError
from backend_py.models import CreateSourceRequest, Source
from backend_py.services import extract_and_generate, fetch_url, summarize, summarize_plain

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=list[Source])
def list_sources(store: StoreDep):
    return store.list_sources()


@router.post("", response_model=Source)
def create_source(body: CreateSourceRequest, store: StoreDep):
    if not body.name:
        raise HTTPException(status_code=400, detail="name required")
    sid = store.create_source(
        name=body.name,
        url=body.url or "",
        raw_content=body.raw_content or "",
        summary="",
    )
    src = store.get_source(sid)
    if not src:
        raise HTTPException(status_code=500, detail="create failed")
    return src


@router.get("/{id}", response_model=Source)
def get_source(id: int, store: StoreDep):
    src = store.get_source(id)
    if not src:
        raise HTTPException(status_code=404, detail="source not found")
    return src


@router.delete("/{id}", status_code=204)
def delete_source(id: int, store: StoreDep):
    try:
        store.delete_source(id)
    except SourceNotFoundError:
        raise HTTPException(status_code=404, detail="source not found")


@router.post("/{id}/fetch", response_model=Source)
def fetch_source(id: int, store: StoreDep):
    src = store.get_source(id)
    if not src:
        raise HTTPException(status_code=404, detail="source not found")
    if not src.url:
        raise HTTPException(status_code=400, detail="source has no URL to fetch")
    try:
        html = fetch_url(src.url)
    except ValueError as e:
        logger.warning("[FetchSource] fetch error source_id=%s url=%s: %s", id, src.url, e)
        raise HTTPException(status_code=502, detail="fetch failed: " + str(e))
    except Exception as e:
        logger.exception("[FetchSource] unexpected fetch error source_id=%s url=%s", id, src.url)
        raise HTTPException(status_code=502, detail="fetch failed: " + str(e))
    key = get_settings().openai_api_key
    if key:
        logger.info("[FetchSource] using OpenAI for main page (source_id=%s, url=%s)", id, src.url)
        try:
            summary_text = summarize(api_key=key, page_text=html)
            logger.info("[FetchSource] OpenAI main page summary OK")
        except Exception as e:
            logger.warning("[FetchSource] OpenAI main page failed, using fallback: %s", e)
            summary_text = summarize_plain(html, 500)
    else:
        logger.info("[FetchSource] no OpenAI API key, using plain excerpt for summary")
        summary_text = summarize_plain(html, 500)
    store.update_source_content(id, html, summary_text)
    extract_and_generate(store, id, html)
    out = store.get_source(id)
    if not out:
        raise HTTPException(status_code=500, detail="fetch failed")
    return out


@router.post("/{id}/extract", response_model=Source)
def extract_source(id: int, store: StoreDep):
    src = store.get_source(id)
    if not src:
        raise HTTPException(status_code=404, detail="source not found")
    raw = src.raw_content or ""
    if not raw:
        raise HTTPException(status_code=400, detail="no content to extract; add raw content or fetch URL first")
    extract_and_generate(store, id, raw)
    out = store.get_source(id)
    if not out:
        raise HTTPException(status_code=500, detail="extract failed")
    return out


@router.get("/{id}/concepts")
def list_concepts(id: int, store: StoreDep):
    return store.list_concepts_by_source(id)
