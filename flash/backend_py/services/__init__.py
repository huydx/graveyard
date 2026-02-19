"""Business logic: fetch, summarize, extract, quiz generation, concept pipeline."""
from .concepts import extract_and_generate
from .extract import extract_concepts, summarize_plain
from .fetcher import fetch_url
from .quizgen import generate_items
from .summarizer import extract_tils, summarize

__all__ = [
    "extract_and_generate",
    "extract_concepts",
    "extract_tils",
    "fetch_url",
    "generate_items",
    "summarize",
    "summarize_plain",
]
