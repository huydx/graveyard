from __future__ import annotations

import json
from pathlib import Path

from google.auth.credentials import Credentials
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials as UserCredentials
from google_auth_oauthlib.flow import InstalledAppFlow

from accountant.config import CREDENTIALS_PATH, GOOGLE_SCOPES, TOKEN_PATH


def _client_json_kind(path: Path) -> str:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as e:
        raise ValueError(f"Could not read JSON credentials at {path}: {e}") from e
    if data.get("type") == "service_account":
        return "service_account"
    if "installed" in data or "web" in data:
        return "oauth_client"
    raise ValueError(
        f"{path} is not a supported Google credentials file. "
        "Use either (1) an OAuth client JSON from APIs & Services → Credentials → "
        "OAuth client ID → type **Desktop app** (top-level key `installed`), or "
        "(2) a **service account** key JSON (`type`: `service_account`). "
        "Do not use API keys or unrelated IAM JSON."
    )


def get_credentials() -> Credentials:
    if not CREDENTIALS_PATH.is_file():
        raise FileNotFoundError(
            f"Missing credentials file: {CREDENTIALS_PATH}. "
            "Set GOOGLE_CREDENTIALS_PATH or add credentials.json (OAuth Desktop or service account)."
        )

    if _client_json_kind(CREDENTIALS_PATH) == "service_account":
        return service_account.Credentials.from_service_account_file(
            str(CREDENTIALS_PATH),
            scopes=GOOGLE_SCOPES,
        )

    creds: UserCredentials | None = None
    if TOKEN_PATH.exists():
        creds = UserCredentials.from_authorized_user_file(str(TOKEN_PATH), GOOGLE_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            try:
                flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), GOOGLE_SCOPES)
            except ValueError as e:
                raise ValueError(
                    f"{CREDENTIALS_PATH}: {e}. "
                    "Download the OAuth client JSON for a **Desktop** app (or use a service account key)."
                ) from e
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
    return creds
