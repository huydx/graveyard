"""SQLite connection factory."""
import sqlite3
from pathlib import Path

from backend_py.config import get_settings


def get_db_path() -> str:
    path = Path(get_settings().data_dir)
    path.mkdir(parents=True, exist_ok=True)
    return str(path / "flash.db")


def get_connection(db_path: str | None = None, check_same_thread: bool = False) -> sqlite3.Connection:
    path = db_path or get_db_path()
    conn = sqlite3.connect(path, check_same_thread=check_same_thread)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn
