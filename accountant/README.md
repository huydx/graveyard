# Accountant

Parse receipt images with the Gemini API and append rows to a Google Sheet (same idea as a Google Apps Script workflow, but with a local FastAPI backend and optional React UI).

## Prerequisites

- **Python** 3.10 or newer
- **Node.js** 18+ (only if you use the Vite frontend)
- **[Google Cloud SDK](https://cloud.google.com/sdk)** (`gcloud`) — optional but useful to enable APIs from the terminal
- A **Google Cloud** project with the **Google Sheets API** enabled (see below)
- **OAuth 2.0** “Desktop app” client credentials (JSON) for Sheets access — the Python app uses this + a browser login, not your `gcloud` user credentials
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey) (`GEMINI_API_KEY`)

### Enable Google Sheets API with `gcloud`

Pick or create a project, sign in, then enable the API:

```bash
gcloud auth login
gcloud projects list                                    # pick PROJECT_ID
gcloud config set project PROJECT_ID
gcloud services enable sheets.googleapis.com
```

To confirm it is on:

```bash
gcloud services list --enabled --filter=name:sheets.googleapis.com
```

You can also enable the API in [Google Cloud Console](https://console.cloud.google.com/apis/library/sheets.googleapis.com) for the same project; `gcloud` and the console are equivalent for this step.

## 1. Clone and enter the project

```bash
cd accountant
```

## 2. Python environment and install

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Alternatively, without editable install:

```bash
pip install -r requirements.txt
```

Then run commands with `python -m accountant` instead of the `accountant` CLI (see below).

## 3. Configuration

1. Copy the example env file and edit it:

   ```bash
   cp .env.example .env
   ```

2. Set at least **`GEMINI_API_KEY`** in `.env`.

3. Adjust **`GOOGLE_SHEETS_SPREADSHEET_ID`** and **`GOOGLE_SHEETS_RANGE`** if your sheet differs from the defaults in `.env.example`. The range must match your tab and columns (expected layout: Date, Place, Category, Payment Method, Price).

4. Google Sheets auth — point **`GOOGLE_CREDENTIALS_PATH`** (or **`credentials.json`** in the project root) at **one** of:

   - **OAuth Desktop client** JSON from [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials** → **OAuth client ID** → application type **Desktop app**. The file must contain a top-level **`"installed"`** object (Google’s download format).
   - **Service account key** JSON (`"type": "service_account"`). Create a service account, grant it access, then **Keys** → **Add key** → JSON. **Share your spreadsheet** with that service account’s email (`…@….iam.gserviceaccount.com`) as **Editor** (or Viewer if you only read — this app appends, so Editor).

5. Optional:

   - **`GOOGLE_TOKEN_PATH`** — where to store the OAuth refresh token (default: `token.json` in the project root).
   - **`ACCOUNTANT_TZ`** — IANA timezone for the Date column (e.g. `Asia/Tokyo`). Default is the machine’s local timezone.
   - **`ACCOUNTANT_PUBLIC_HOST`** — short hostname you open in the browser (e.g. `huydx` for `http://huydx` on Tailscale MagicDNS). The API adds matching `http://…` CORS origins for that host on ports 80 (naked URL), 8765, 5173, and 4173.
   - **`ACCOUNTANT_CORS_ORIGINS`** — comma-separated extra origins if you still need more (HTTPS, odd ports, full URLs).

The first time the app needs Google Sheets with **OAuth** (not a service account), it opens a browser for sign-in and writes **`token.json`** (unless you pointed `GOOGLE_TOKEN_PATH` elsewhere).

## 4. Run modes

Use either the installed script (after `pip install -e .`) or the module form:

| After `pip install -e .` | Without install |
|--------------------------|-----------------|
| `accountant …`           | `python -m accountant …` |

### CLI: parse one image and append to the sheet

```bash
accountant add /path/to/receipt.jpg
```

- **`--dry-run`** — call Gemini only and print JSON; do not write to the sheet.
- **`--force`** — append even if the same place + total already exists.

### API server (for the UI or HTTP clients)

```bash
accountant serve
```

Defaults: bind **0.0.0.0:8765** (reachable on your LAN and Tailscale; use `http://127.0.0.1:8765` or your Tailscale IP from another device).  
Useful flags: `--host 127.0.0.1` (local only), `--port`, `--reload` (auto-reload on code changes).

### Web UI — development (two processes)

Terminal A — API:

```bash
accountant serve --reload
```

Terminal B — Vite dev server (proxies `/api` to port 8765):

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** when the API and Vite run on the same machine (Vite proxies `/api` to `127.0.0.1:8765`). To use the UI from another Tailscale device, run **`npm run build`** and open **`http://<server-tailscale-ip>:8765`** or **`http://<MagicDNS-name>:8765`** on that device (single process serves UI + API). Set **`ACCOUNTANT_PUBLIC_HOST`** to that short hostname (e.g. `huydx`) so CORS allows `http://huydx:8765`. For any other origin, use **`ACCOUNTANT_CORS_ORIGINS`**.

### Web UI — single server (built frontend)

Build static assets, then run only the Python server:

```bash
cd frontend
npm install
npm run build
cd ..
accountant serve
```

Open **http://127.0.0.1:8765** locally, or **`http://huydx:8765`** / **`http://<tailscale-ip>:8765`** from another device — the app serves `frontend/dist` when present (set **`ACCOUNTANT_PUBLIC_HOST=huydx`** if you use a hostname without adding each origin by hand).

## Troubleshooting

- **`Set GEMINI_API_KEY in .env`** — add the key to `.env` and ensure you run commands from the project directory (or that `python-dotenv` can find `.env`; paths are resolved relative to the package layout as in `accountant/config.py`).
- **`Missing OAuth client file`** — add `credentials.json` (Desktop OAuth client) or set `GOOGLE_CREDENTIALS_PATH`.
- **`Client secrets must be for a web or installed app`** — the JSON at `GOOGLE_CREDENTIALS_PATH` is not an OAuth **Desktop** (or Web) client file. Typical mistake: a **service account** key (then the app will use it automatically once you share the sheet with that email) or the wrong download from the console. Fix: use a Desktop OAuth client JSON, or switch to a service account key and share the spreadsheet with the SA.
