"""Fetch URL and return raw response body (no HTML parsing)."""
import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (compatible; FlashQuizBot/1.0; +https://github.com/flash-quiz)"
DEFAULT_TIMEOUT = 60.0


def fetch_url(url: str, timeout: float = DEFAULT_TIMEOUT) -> str:
    """Fetch URL and return the raw response body as UTF-8 string."""
    url = (url or "").strip()
    if not url:
        raise ValueError("URL is empty")
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Invalid URL: missing scheme or host")
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Invalid URL: only http and https are supported")

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": USER_AGENT})
            r.raise_for_status()
            r.encoding = "utf-8"
            text = r.text
    except httpx.TimeoutException as e:
        logger.warning("fetch_url timeout url=%s: %s", url, e)
        raise ValueError(f"Request timed out after {timeout}s") from e
    except httpx.ConnectError as e:
        logger.warning("fetch_url connect error url=%s: %s", url, e)
        raise ValueError(f"Cannot connect: {e!s}") from e
    except httpx.HTTPStatusError as e:
        body = (e.response.text or "")[:200]
        msg = f"HTTP {e.response.status_code}"
        if body:
            msg += f": {body}"
        logger.warning("fetch_url HTTP error url=%s: %s", url, msg)
        raise ValueError(msg) from e

    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("response body is not valid UTF-8")
    return text
