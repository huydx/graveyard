"""Store: SQLite CRUD for sources, concepts, quiz_items, quiz_reviews."""
import json
import sqlite3
from datetime import datetime
from typing import Optional

from backend_py.models import Concept, QuizItem, Source

from .connection import get_connection
from .schema import migrate


class StoreError(Exception):
    pass


class SourceNotFoundError(StoreError):
    pass


def _parse_dt(v) -> datetime:
    if v is None:
        return datetime.utcnow()
    if isinstance(v, datetime):
        return v
    s = str(v).replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def _row_to_source(row: sqlite3.Row) -> Source:
    return Source(
        id=row["id"],
        name=row["name"],
        url=row["url"] or "",
        raw_content=row["raw_content"] or "",
        summary=row["summary"] or "",
        created_at=_parse_dt(row["created_at"]),
        updated_at=_parse_dt(row["updated_at"]),
    )


def _row_to_concept(row: sqlite3.Row) -> Concept:
    return Concept(
        id=row["id"],
        source_id=row["source_id"],
        title=row["title"],
        summary=row["summary"] or "",
        detail=row["detail"] or "",
        created_at=_parse_dt(row["created_at"]),
    )


def _row_to_quiz_item(row: sqlite3.Row) -> QuizItem:
    opt = row["options"]
    options = None
    if opt and opt != "[]":
        try:
            options = json.loads(opt)
        except json.JSONDecodeError:
            options = None
    return QuizItem(
        id=row["id"],
        concept_id=row["concept_id"],
        type=row["type"],
        prompt=row["prompt"],
        answer=row["answer"],
        options=options,
        created_at=_parse_dt(row["created_at"]),
    )


class Store:
    def __init__(self, conn: Optional[sqlite3.Connection] = None, db_path: Optional[str] = None):
        if conn is not None:
            self._conn = conn
            self._own = False
        else:
            self._conn = get_connection(db_path, check_same_thread=False)
            self._own = True
        migrate(self._conn)

    def close(self) -> None:
        if self._own and self._conn:
            self._conn.close()
            self._conn = None

    def create_source(self, name: str, url: str = "", raw_content: str = "", summary: str = "") -> int:
        cur = self._conn.execute(
            "INSERT INTO sources (name, url, raw_content, summary, updated_at) VALUES (?, ?, ?, ?, datetime('now'))",
            (name, url or None, raw_content or None, summary or None),
        )
        self._conn.commit()
        return cur.lastrowid

    def update_source_summary(self, id: int, summary: str) -> None:
        self._conn.execute(
            "UPDATE sources SET summary = ?, updated_at = datetime('now') WHERE id = ?",
            (summary, id),
        )
        self._conn.commit()

    def update_source_content(self, id: int, raw_content: str, summary: str) -> None:
        self._conn.execute(
            "UPDATE sources SET raw_content = ?, summary = ?, updated_at = datetime('now') WHERE id = ?",
            (raw_content, summary, id),
        )
        self._conn.commit()

    def list_sources(self) -> list[Source]:
        cur = self._conn.execute(
            "SELECT id, name, COALESCE(url,'') AS url, COALESCE(raw_content,'') AS raw_content, COALESCE(summary,'') AS summary, created_at, updated_at FROM sources ORDER BY updated_at DESC"
        )
        return [_row_to_source(row) for row in cur.fetchall()]

    def get_source(self, id: int) -> Optional[Source]:
        cur = self._conn.execute(
            "SELECT id, name, COALESCE(url,'') AS url, COALESCE(raw_content,'') AS raw_content, COALESCE(summary,'') AS summary, created_at, updated_at FROM sources WHERE id = ?",
            (id,),
        )
        row = cur.fetchone()
        return _row_to_source(row) if row else None

    def delete_source(self, id: int) -> None:
        cur = self._conn.execute("DELETE FROM sources WHERE id = ?", (id,))
        self._conn.commit()
        if cur.rowcount == 0:
            raise SourceNotFoundError("source not found")

    def create_concept(self, source_id: int, title: str, summary: str = "", detail: str = "") -> int:
        cur = self._conn.execute(
            "INSERT INTO concepts (source_id, title, summary, detail) VALUES (?, ?, ?, ?)",
            (source_id, title, summary or None, detail or None),
        )
        self._conn.commit()
        return cur.lastrowid

    def list_concepts_by_source(self, source_id: int) -> list[Concept]:
        cur = self._conn.execute(
            "SELECT id, source_id, title, COALESCE(summary,'') AS summary, COALESCE(detail,'') AS detail, created_at FROM concepts WHERE source_id = ? ORDER BY id",
            (source_id,),
        )
        return [_row_to_concept(row) for row in cur.fetchall()]

    def list_all_concepts(self) -> list[Concept]:
        cur = self._conn.execute(
            "SELECT id, source_id, title, COALESCE(summary,'') AS summary, COALESCE(detail,'') AS detail, created_at FROM concepts ORDER BY id"
        )
        return [_row_to_concept(row) for row in cur.fetchall()]

    def get_concept(self, id: int) -> Optional[Concept]:
        cur = self._conn.execute(
            "SELECT id, source_id, title, COALESCE(summary,'') AS summary, COALESCE(detail,'') AS detail, created_at FROM concepts WHERE id = ?",
            (id,),
        )
        row = cur.fetchone()
        return _row_to_concept(row) if row else None

    def delete_concepts_by_source(self, source_id: int) -> None:
        self._conn.execute("DELETE FROM concepts WHERE source_id = ?", (source_id,))
        self._conn.commit()

    def create_quiz_item(self, concept_id: int, item_type: str, prompt: str, answer: str, options: Optional[list[str]] = None) -> int:
        opt_json = json.dumps(options) if options else None
        cur = self._conn.execute(
            "INSERT INTO quiz_items (concept_id, type, prompt, answer, options) VALUES (?, ?, ?, ?, ?)",
            (concept_id, item_type, prompt, answer, opt_json),
        )
        self._conn.commit()
        return cur.lastrowid

    def get_quiz_item(self, id: int) -> Optional[QuizItem]:
        cur = self._conn.execute(
            "SELECT id, concept_id, type, prompt, answer, COALESCE(options,'[]') AS options, created_at FROM quiz_items WHERE id = ?",
            (id,),
        )
        row = cur.fetchone()
        return _row_to_quiz_item(row) if row else None

    def get_daily_quiz_items(self, limit: int = 15) -> list[QuizItem]:
        cur = self._conn.execute(
            "SELECT id, concept_id, type, prompt, answer, COALESCE(options,'[]') AS options, created_at FROM quiz_items ORDER BY RANDOM() LIMIT ?",
            (limit,),
        )
        return [_row_to_quiz_item(row) for row in cur.fetchall()]

    def record_review(self, quiz_item_id: int, correct: bool) -> None:
        self._conn.execute(
            "INSERT INTO quiz_reviews (quiz_item_id, reviewed_at, correct) VALUES (?, date('now'), ?)",
            (quiz_item_id, 1 if correct else 0),
        )
        self._conn.commit()
