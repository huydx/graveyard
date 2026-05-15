import os
from datetime import datetime
from zoneinfo import ZoneInfo

from googleapiclient.discovery import build

from accountant.auth_google import get_credentials
from accountant.config import SHEET_RANGE, SPREADSHEET_ID

_HEADER = ["Date", "Place", "Category", "Payment Method", "Price (¥)"]


def _sheets_service():
    creds = get_credentials()
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _sheet_title_and_range() -> tuple[str, str]:
    """Sheet1!A:E -> ('Sheet1', 'A:E')."""
    if "!" in SHEET_RANGE:
        title, r = SHEET_RANGE.split("!", 1)
        return title, r
    return "Sheet1", "A:E"


def get_values() -> list[list]:
    title, col_range = _sheet_title_and_range()
    rng = f"{title}!{col_range}"
    service = _sheets_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=SPREADSHEET_ID, range=rng)
        .execute()
    )
    return result.get("values") or []


def ensure_headers() -> None:
    """If the sheet has no rows, write the same header row as Code.gs."""
    rows = get_values()
    if rows:
        return
    title, col_range = _sheet_title_and_range()
    if ":" in col_range:
        left, right = col_range.split(":", 1)
        left = "".join(c for c in left if not c.isdigit()) or "A"
        right = "".join(c for c in right if not c.isdigit()) or "E"
    else:
        left = right = "".join(c for c in col_range if not c.isdigit()) or "A"
    rng = f"{title}!{left}1:{right}1"

    service = _sheets_service()
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=rng,
        valueInputOption="USER_ENTERED",
        body={"values": [_HEADER]},
    ).execute()


def check_duplicate(place: str, total: int) -> tuple[bool, str]:
    """
    Same logic as Apps Script: scan column B (Place) and E (Price) from row 2.
    Returns (found, existing_date_string).
    """
    rows = get_values()
    if len(rows) <= 1:
        return False, ""

    data_rows = rows[1:]
    normalise = lambda s: str(s).strip().lower()
    target_place = normalise(place)
    target_total = int(round(total))

    for raw in data_rows:
        row = list(raw)
        if len(row) < 5:
            row.extend([""] * (5 - len(row)))
        row_place = normalise(row[1])
        try:
            row_total = int(round(float(str(row[4]).replace(",", "").replace("¥", "").strip() or 0)))
        except ValueError:
            row_total = 0
        if row_place == target_place and row_total == target_total:
            return True, str(row[0])
    return False, ""


def _today_yyyy_mm_dd() -> str:
    tz_name = os.environ.get("ACCOUNTANT_TZ", "").strip()
    if tz_name:
        return datetime.now(ZoneInfo(tz_name)).strftime("%Y-%m-%d")
    return datetime.now().astimezone().strftime("%Y-%m-%d")


def add_record_to_sheet(record: dict) -> None:
    """Append one row: Date | Place | Category | Payment Method | Price (¥)."""
    ensure_headers()

    today = _today_yyyy_mm_dd()

    title, _ = _sheet_title_and_range()
    append_range = f"{title}!A:E"

    new_row = [
        today,
        record["place"],
        record["category"],
        record["paymentMethod"],
        record["total"],
    ]

    service = _sheets_service()
    service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range=append_range,
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [new_row]},
    ).execute()
