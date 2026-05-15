import base64
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

from accountant.config import CATEGORIES, GEMINI_API_KEY

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent?key="
)

_MIME_BY_SUFFIX = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _mime_for_path(path: Path) -> str:
    return _MIME_BY_SUFFIX.get(path.suffix.lower(), "image/jpeg")


def _build_prompt() -> str:
    cats = ", ".join(CATEGORIES)
    return (
        "You are a receipt parser. Analyze this receipt image and extract:\n\n"
        "1. place: the store, restaurant, or vendor name (e.g. \"7-Eleven\", \"Starbucks Shibuya\"). "
        "If not visible, use \"Unknown\".\n"
        "2. total: the FINAL total amount paid (the largest/last total on the receipt). "
        "Return as a plain integer in yen — no symbols, no decimals, no commas.\n"
        "3. paymentMethod: how it was paid. Common values: Cash, Credit Card, IC Card (Suica/Pasmo), "
        "QR Code (PayPay/LINE Pay), Debit Card. If unclear, use \"Unknown\".\n"
        f"4. category: the best match from this list: {cats}\n\n"
        "Return ONLY a single JSON object — no markdown, no explanation:\n"
        '{"place":"...","total":0,"paymentMethod":"...","category":"..."}\n'
        "If you cannot read the receipt at all, return:\n"
        '{"place":"Unknown","total":0,"paymentMethod":"Unknown","category":"Eat out"}'
    )


def parse_receipt_image(image_path: Path) -> dict:
    """Call Gemini with the same contract as Apps Script parseReceiptImage."""
    if not GEMINI_API_KEY:
        raise ValueError("Set GEMINI_API_KEY in .env (same key you use in Code.gs / AI Studio).")

    path = image_path.resolve()
    if not path.is_file():
        raise FileNotFoundError(path)

    b64 = base64.standard_b64encode(path.read_bytes()).decode("ascii")
    mime = _mime_for_path(path)

    body = {
        "contents": [
            {
                "parts": [
                    {"text": _build_prompt()},
                    {"inline_data": {"mime_type": mime, "data": b64}},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.1, "topP": 0.8},
    }

    url = _GEMINI_URL + GEMINI_API_KEY
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini HTTP {e.code}: {err_body}") from e

    if result.get("error"):
        raise RuntimeError("Gemini API error: " + str(result["error"].get("message", result["error"])))

    candidates = result.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no response. The image may be too blurry.")

    text = (candidates[0].get("content") or {}).get("parts") or [{}]
    raw = text[0].get("text", "").strip()

    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise RuntimeError("Could not read the receipt. Try a clearer, better-lit photo.")

    data = json.loads(match.group(0))
    cat = str(data.get("category") or "").strip()
    if cat not in CATEGORIES:
        cat = CATEGORIES[0]

    return {
        "place": str(data.get("place") or "Unknown").strip(),
        "total": int(round(float(data.get("total") or 0))),
        "paymentMethod": str(data.get("paymentMethod") or "Unknown").strip(),
        "category": cat,
    }
