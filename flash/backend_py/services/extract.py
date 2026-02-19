"""Fallback extraction: heuristic concepts and plain summarization (no LLM)."""
import re
from dataclasses import dataclass


@dataclass
class ConceptChunk:
    title: str
    summary: str
    detail: str


JUNK_PATTERN = re.compile(r"(?i)^(/\*|\*/|cspell:|eslint|@ts-|<!--|-->).*")
SYMBOL_ONLY = re.compile(r"^[\s*\/#\-_.\,\;:\!\?\<\>\{\}\[\]\(\)]+$")


def _is_junk_concept(title: str) -> bool:
    title = title.strip()
    if len(title) < 3:
        return True
    if SYMBOL_ONLY.match(title):
        return True
    if JUNK_PATTERN.match(title):
        return True
    if not any(("a" <= c <= "z") or ("A" <= c <= "Z") for c in title):
        return True
    return False


def _first_sentence(s: str, max_len: int) -> str:
    s = s.strip()
    for sep in (". ", ".\n", "! ", "? "):
        i = s.find(sep)
        if i >= 0:
            out = s[: i + 1]
            return out[:max_len] + "..." if len(out) > max_len else out
    return s[:max_len] + "..." if len(s) > max_len else s


def extract_concepts(raw: str) -> list[ConceptChunk]:
    """Split raw content into concept chunks (headings + body or paragraphs)."""
    raw = raw.strip()
    if not raw:
        return []
    blocks = re.split(r"\n\s*\n", raw)
    chunks: list[ConceptChunk] = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        parts = b.split("\n", 1)
        title = parts[0].strip()
        title = title.lstrip("- *").lstrip()
        title = re.sub(r"^#+\s*", "", title)
        if _is_junk_concept(title):
            continue
        if len(title) > 200:
            title = title[:197] + "..."
        detail = parts[1].strip() if len(parts) > 1 else ""
        if len(detail) > 1500:
            detail = detail[:1497] + "..."
        summary = title
        if detail:
            summary = title + ": " + _first_sentence(detail, 120)
        chunks.append(ConceptChunk(title=title, summary=summary, detail=detail))
    return chunks


def summarize_plain(raw: str, max_len: int = 500) -> str:
    """Produce a short summary from first block of raw content (no LLM)."""
    raw = raw.strip()
    if not raw:
        return ""
    blocks = re.split(r"\n\s*\n", raw, maxsplit=1)
    first = blocks[0].strip()
    if len(first) > max_len:
        return first[:max_len] + "..."
    return first
