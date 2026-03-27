"""Notion API integration: read TIL page content and write summary back."""
import logging
from typing import Optional

from notion_client import Client

from backend_py.config import get_settings

logger = logging.getLogger(__name__)


def _client(token: Optional[str] = None) -> Client:
    tok = token or get_settings().notion_token
    if not tok:
        raise ValueError("Notion token required: set NOTION_TOKEN")
    return Client(auth=tok)


def _blocks_to_text(blocks: list[dict]) -> str:
    """Flatten Notion block list into plain text."""
    lines: list[str] = []
    for block in blocks:
        btype = block.get("type", "")
        content = block.get(btype, {})
        rich_text = content.get("rich_text", [])
        text = "".join(rt.get("plain_text", "") for rt in rich_text)
        if text:
            lines.append(text)
    return "\n".join(lines)


def read_til_page(page_id: Optional[str] = None, token: Optional[str] = None) -> tuple[str, str]:
    """Read a Notion page and return (title, plain_text_content)."""
    pid = page_id or get_settings().notion_til_page_id
    if not pid:
        raise ValueError("Notion page ID required: set NOTION_TIL_PAGE_ID")
    nc = _client(token)

    page = nc.pages.retrieve(page_id=pid)
    props = page.get("properties", {})
    title_prop = props.get("title") or props.get("Name") or {}
    title_parts = title_prop.get("title", [])
    title = "".join(rt.get("plain_text", "") for rt in title_parts)

    response = nc.blocks.children.list(block_id=pid, page_size=100)
    blocks = response.get("results", [])
    while response.get("has_more"):
        response = nc.blocks.children.list(
            block_id=pid, page_size=100, start_cursor=response["next_cursor"]
        )
        blocks.extend(response.get("results", []))

    text = _blocks_to_text(blocks)
    logger.info("[Notion] read page id=%s title=%r content_len=%d", pid, title, len(text))
    return title, text


def write_summary_to_page(
    summary: str,
    page_id: Optional[str] = None,
    token: Optional[str] = None,
) -> None:
    """Append a divider and summary callout block to the Notion page."""
    pid = page_id or get_settings().notion_til_page_id
    if not pid:
        raise ValueError("Notion page ID required: set NOTION_TIL_PAGE_ID")
    nc = _client(token)

    children = [
        {"object": "block", "type": "divider", "divider": {}},
        {
            "object": "block",
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": "Summary"}, "annotations": {"bold": True}}],
                "icon": {"type": "emoji", "emoji": "📝"},
                "color": "blue_background",
            },
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": summary}}]
            },
        },
    ]
    nc.blocks.children.append(block_id=pid, children=children)
    logger.info("[Notion] wrote summary to page id=%s summary_len=%d", pid, len(summary))
