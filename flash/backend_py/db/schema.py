"""SQLite DDL and migration."""
import sqlite3

SCHEMA = """
-- Sources: Notion links, URLs, or pasted content
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT,
    raw_content TEXT,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Concepts extracted from sources (TILs / core ideas to quiz)
CREATE TABLE IF NOT EXISTS concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_concepts_source ON concepts(source_id);

-- Quiz items: flashcard or multiple choice
CREATE TABLE IF NOT EXISTS quiz_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concept_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('flashcard', 'multiple_choice')),
    prompt TEXT NOT NULL,
    answer TEXT NOT NULL,
    options TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quiz_items_concept ON quiz_items(concept_id);

-- Track when user last saw each item
CREATE TABLE IF NOT EXISTS quiz_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_item_id INTEGER NOT NULL,
    reviewed_at DATE NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    FOREIGN KEY (quiz_item_id) REFERENCES quiz_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quiz_reviews_item ON quiz_reviews(quiz_item_id);
CREATE INDEX IF NOT EXISTS idx_quiz_reviews_date ON quiz_reviews(reviewed_at);
"""


def migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
