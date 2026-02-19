"""Concept pipeline: extract TILs (LLM or heuristic) and generate quiz items."""
import logging
from typing import TYPE_CHECKING

from backend_py.config import get_settings

from .extract import ConceptChunk, extract_concepts, summarize_plain
from .summarizer import extract_tils

if TYPE_CHECKING:
    from backend_py.db import Store

logger = logging.getLogger(__name__)


def _extract_concepts_with_llm(raw: str) -> list[ConceptChunk]:
    """Use OpenAI ExtractTILs; fallback to heuristic extract_concepts."""
    key = get_settings().openai_api_key
    if not key:
        logger.info("[Concepts] no OpenAI key; using heuristic ExtractConcepts")
        return extract_concepts(raw)
    try:
        tils = extract_tils(api_key=key, page_text=raw)
    except Exception as e:
        logger.warning("[Concepts] ExtractTILs failed, falling back: %s", e)
        return extract_concepts(raw)
    if not tils:
        logger.info("[Concepts] ExtractTILs returned 0 items, falling back to ExtractConcepts")
        return extract_concepts(raw)
    chunks: list[ConceptChunk] = []
    for i, t in enumerate(tils):
        link = (t.get("link") or "").strip()
        content = (t.get("content") or "").strip()
        link_summary = (t.get("linkSummary") or "").strip()
        if not link_summary and not content:
            continue
        if not link_summary:
            link_summary = summarize_plain(content, 240)
        title = content or link_summary
        if len(title) > 200:
            title = title[:197] + "..."
        detail_parts = [link_summary]
        if content:
            detail_parts.extend(["", content])
        if link:
            detail_parts.extend(["", "Link: " + link])
        detail = "\n".join(detail_parts)
        chunks.append(ConceptChunk(title=title, summary=link_summary, detail=detail))
        logger.info("[Concepts] TIL #%d: link=%r title=%r summary_len=%d", i + 1, link, title, len(link_summary))
    logger.info("[Concepts] total TIL-based concepts: %d", len(chunks))
    return chunks


def extract_and_generate(store: "Store", source_id: int, raw: str) -> None:
    """Delete existing concepts for source, extract TILs, persist concepts and quiz items."""
    from backend_py.services import quizgen

    store.delete_concepts_by_source(source_id)
    chunks = _extract_concepts_with_llm(raw)
    for c in chunks:
        store.create_concept(source_id, c.title, c.summary, c.detail)
    concepts = store.list_concepts_by_source(source_id)
    all_concepts = store.list_all_concepts()
    for concept in concepts:
        fc, mc = quizgen.generate_items(concept, all_concepts)
        if fc:
            store.create_quiz_item(concept.id, fc.type, fc.prompt, fc.answer, fc.options)
        if mc:
            store.create_quiz_item(concept.id, mc.type, mc.prompt, mc.answer, mc.options)
