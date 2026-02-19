"""OpenAI summarization and TIL extraction. Logs raw response bodies."""
import json
import logging
from typing import Optional

from openai import OpenAI

from backend_py.config import get_settings

logger = logging.getLogger(__name__)

MAX_INPUT_CHARS = 30_000


def _client(api_key: Optional[str] = None) -> tuple[OpenAI, str]:
    key = api_key or get_settings().openai_api_key
    if not key:
        raise ValueError("OpenAI API key required: set OPENAI_API_KEY")
    return OpenAI(api_key=key), get_settings().openai_summarize_model


def summarize(api_key: Optional[str] = None, page_text: str = "") -> str:
    """Return a short summary of the page using OpenAI."""
    client, model = _client(api_key)
    text = page_text
    if len(text) > MAX_INPUT_CHARS:
        text = text[:MAX_INPUT_CHARS] + "\n\n[Content truncated for API limit.]"
    logger.info("[OpenAI] calling API (model=%s, input_len=%d)", model, len(text))
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "Summarize the following web page or note in 2–4 concise paragraphs. "
                "Capture the main ideas and key facts. Output only the summary, no preamble.\n\n---\n\n" + text,
            }
        ],
    )
    logger.info("[OpenAI] raw summarize response: %s", resp.model_dump_json())
    if not resp.choices:
        raise ValueError("OpenAI returned no choices")
    out = (resp.choices[0].message.content or "").strip()
    logger.info("[OpenAI] response OK (summary_len=%d)", len(out))
    return out


_TIL_PROMPT_PREFIX = """You are helping me build a spaced-repetition system from raw HTML pages or notes.

The content below is raw HTML (possibly with some plain text mixed in). Ignore boilerplate such as navigation menus, headers, footers, cookie banners, or unrelated UI. Focus on the main article or note content.

From that content, find each meaningful "Today I Learned" (TIL) item. A TIL is:
- A specific fact, idea, technique, or link that I might want to remember later.

For each TIL, output an object:
- "link": the main URL associated with this TIL (if any, otherwise the empty string).
- "content": a short human-readable description of what I learned (1–2 sentences, no markdown).
- "linkSummary": a 2–4 sentence summary of what I would learn if I followed this TIL (what the link or idea teaches).

Very important:
- Return ONLY a single JSON object with this exact shape:
  { "items": [ { "link": "...", "content": "...", "linkSummary": "..." }, ... ] }
- Do not include any extra keys, comments, or explanations.

Content:
---
"""


def extract_tils(api_key: Optional[str] = None, page_text: str = "") -> list[dict]:
    """Extract TILs from raw HTML/page text via OpenAI. Returns list of {link, content, linkSummary}."""
    client, model = _client(api_key)
    text = page_text
    if len(text) > MAX_INPUT_CHARS:
        text = text[:MAX_INPUT_CHARS] + "\n\n[Content truncated for API limit.]"
    logger.info("[OpenAI] extracting TILs (model=%s, input_len=%d)", model, len(text))
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": _TIL_PROMPT_PREFIX + text}],
        response_format={"type": "json_object"},
    )
    logger.info("[OpenAI] raw TILs response: %s", resp.model_dump_json())
    if not resp.choices:
        raise ValueError("OpenAI returned no choices")
    content = (resp.choices[0].message.content or "").strip()
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        logger.warning("[OpenAI] TILs decode error: %s body=%s", e, content)
        raise ValueError("decode TILs response") from e
    items = data.get("items") or []
    logger.info("[OpenAI] extracted %d TILs", len(items))
    return items
