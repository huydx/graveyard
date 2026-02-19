# Flash backend (Python)

Reimplementation of the Flash backend in Python. Same HTTP API as the Go backend so the existing React frontend works unchanged.

## Structure

- **`config.py`** – Settings from env (`FLASH_DATA_DIR`, `OPENAI_API_KEY`, `OPENAI_SUMMARIZE_MODEL`).
- **`models/`** – Pydantic request/response schemas (`Source`, `Concept`, `QuizItem`, etc.).
- **`db/`** – SQLite: `connection.py`, `schema.py`, `store.py` (CRUD).
- **`services/`** – Business logic: `fetcher`, `summarizer`, `extract`, `quizgen`, `concepts` (TIL pipeline).
- **`api/`** – HTTP layer: `deps.py` (get_store), `routes/sources.py`, `routes/quiz.py`.
- **`main.py`** – FastAPI app, lifespan, CORS, mount of `/api` router.

## Stack

- **FastAPI** – HTTP API
- **SQLite** – same schema as Go (`sources`, `concepts`, `quiz_items`, `quiz_reviews`)
- **OpenAI** – optional: summarization and TIL extraction (env: `OPENAI_API_KEY`, optional `OPENAI_SUMMARIZE_MODEL`, default `gpt-4o-mini`)
- **httpx** – URL fetching (raw HTML, no parsing)

## Run

From the project root (`flash/`):

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend_py/requirements.txt
.venv/bin/uvicorn backend_py.main:app --host 0.0.0.0 --port 8080
```

Optional: set `FLASH_DATA_DIR` to a directory for the SQLite file (default: `./data`).

## API

- `GET/POST /api/sources`, `GET/DELETE /api/sources/:id`
- `POST /api/sources/:id/fetch` – fetch URL, store raw HTML, summarize, extract TILs, generate quiz items
- `POST /api/sources/:id/extract` – re-run TIL extraction + quiz generation on existing `raw_content`
- `GET /api/sources/:id/concepts` – list concepts (TILs) for a source
- `GET /api/quiz/daily` – random quiz items for today
- `POST /api/quiz/items/:id/review` – body `{ "correct": true|false }`

Frontend continues to use `/api` as the base; point it at this server (e.g. proxy or `VITE_API_URL` if you add one).
