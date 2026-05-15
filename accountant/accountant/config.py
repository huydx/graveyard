import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
CREDENTIALS_PATH = Path(os.environ.get("GOOGLE_CREDENTIALS_PATH", ROOT / "credentials.json"))
TOKEN_PATH = Path(os.environ.get("GOOGLE_TOKEN_PATH", ROOT / "token.json"))

SPREADSHEET_ID = os.environ.get(
    "GOOGLE_SHEETS_SPREADSHEET_ID",
    "17XU6KC75nWlOUrhn5mXOi8MvELXh_eCF4SsR8xzs5XY",
)
SHEET_RANGE = os.environ.get("GOOGLE_SHEETS_RANGE", "Sheet1!A:E")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# Same list as Code.gs
CATEGORIES = [
    "Eat out",
    "Office and tech",
    "Travel",
]

GOOGLE_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
