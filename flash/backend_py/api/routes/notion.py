"""Notion TIL note summarization endpoint."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend_py.config import get_settings
from backend_py.services.notion import read_til_page, write_summary_to_page
from backend_py.services.summarizer import summarize

logger = logging.getLogger(__name__)

router = APIRouter()


class NotionSummarizeResponse(BaseModel):
    page_id: str
    title: str
    summary: str


@router.post("/summarize", response_model=NotionSummarizeResponse)
def summarize_til_note():
    """Read the configured Notion TIL page, summarize it, and write the summary back."""
    settings = get_settings()
    if not settings.notion_token:
        raise HTTPException(status_code=400, detail="NOTION_TOKEN not configured")
    if not settings.notion_til_page_id:
        raise HTTPException(status_code=400, detail="NOTION_TIL_PAGE_ID not configured")

    try:
        title, content = read_til_page()
    except Exception as e:
        logger.exception("[Notion] failed to read TIL page")
        raise HTTPException(status_code=502, detail="Failed to read Notion page: " + str(e))

    if not content.strip():
        raise HTTPException(status_code=422, detail="Notion page has no readable content")

    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not configured")

    try:
        summary_text = summarize(api_key=settings.openai_api_key, page_text=content)
    except Exception as e:
        logger.exception("[Notion] failed to summarize content")
        raise HTTPException(status_code=502, detail="Summarization failed: " + str(e))

    try:
        write_summary_to_page(summary=summary_text)
    except Exception as e:
        logger.exception("[Notion] failed to write summary back to page")
        raise HTTPException(status_code=502, detail="Failed to write summary to Notion: " + str(e))

    return NotionSummarizeResponse(
        page_id=settings.notion_til_page_id,
        title=title,
        summary=summary_text,
    )
