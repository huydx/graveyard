"""JSON API for the accountant frontend; optionally serves built static assets."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from accountant.gemini import parse_receipt_image
from accountant.sheets_ops import add_record_to_sheet, check_duplicate

_PACK_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = _PACK_ROOT / "frontend" / "dist"

app = FastAPI(title="Accountant", docs_url=None, redoc_url=None)

_extra_origins = os.environ.get("ACCOUNTANT_CORS_ORIGINS", "")
_cors_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
]
for part in _extra_origins.split(","):
    p = part.strip()
    if p:
        _cors_origins.append(p)

# MagicDNS / mDNS / etc.: browser Origin is http://<host> or http://<host>:port
_public_host = os.environ.get("ACCOUNTANT_PUBLIC_HOST", "").strip()
if _public_host:
    _cors_origins.extend(
        [
            f"http://{_public_host}",
            f"http://{_public_host}:8765",
            f"http://{_public_host}:5173",
            f"http://{_public_host}:4173",
        ]
    )

# Tailscale uses 100.64.0.0/10; allow a dev browser on another node (Vite on :5173, etc.).
_tailscale_http_origin = r"^http://100\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_tailscale_http_origin,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RecordPayload(BaseModel):
    place: str = Field(..., min_length=1)
    total: int
    paymentMethod: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)

    @field_validator("total", mode="before")
    @classmethod
    def total_as_int(cls, v: object) -> int:
        if isinstance(v, bool):
            raise TypeError("total must be a number")
        return int(round(float(v)))


def _looks_like_image(content_type: str | None, data: bytes) -> bool:
    ct = (content_type or "").lower()
    if ct.startswith("image/"):
        return True
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return True
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True
    if len(data) >= 6 and data[:6] in (b"GIF87a", b"GIF89a"):
        return True
    return False


@app.post("/api/parse")
async def api_parse(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not _looks_like_image(file.content_type, data):
        raise HTTPException(status_code=400, detail="Upload an image file (JPEG, PNG, WebP, or GIF).")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20 MB).")
    suffix = Path(file.filename or "receipt").suffix
    if not suffix or suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        suffix = ".jpg"
    path_str: str | None = None
    try:
        fd, path_str = tempfile.mkstemp(suffix=suffix.lower())
        try:
            os.write(fd, data)
        finally:
            os.close(fd)
        path = Path(path_str)
        record = parse_receipt_image(path)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        if path_str is not None:
            Path(path_str).unlink(missing_ok=True)

    dup, existing_date = check_duplicate(record["place"], record["total"])
    return {
        "record": record,
        "duplicate": dup,
        "existing_date": existing_date,
    }


@app.post("/api/append")
def api_append(body: RecordPayload, force: bool = False) -> dict:
    record = {
        "place": body.place.strip(),
        "total": body.total,
        "paymentMethod": body.paymentMethod.strip(),
        "category": body.category.strip(),
    }
    if not force:
        dup, existing_date = check_duplicate(record["place"], record["total"])
        if dup:
            return JSONResponse(
                status_code=409,
                content={"duplicate": True, "existing_date": existing_date},
            )
    try:
        add_record_to_sheet(record)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {"ok": True}


_assets_dir = FRONTEND_DIST / "assets"
if _assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")


@app.get("/")
def spa_index():
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    return PlainTextResponse(
        "API is running. Frontend is a separate Vite app.\n\n"
        "Development: cd frontend && npm install && npm run dev\n"
        "  → open http://127.0.0.1:5173 (proxies /api to this server).\n\n"
        "Single-port UI: cd frontend && npm run build, then restart this server.\n",
        status_code=503,
    )
