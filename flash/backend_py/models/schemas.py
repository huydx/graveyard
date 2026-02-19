"""Pydantic schemas for API (snake_case JSON)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Source(BaseModel):
    id: int
    name: str
    url: str = ""
    raw_content: str = ""
    summary: str = ""
    created_at: datetime
    updated_at: datetime


class Concept(BaseModel):
    id: int
    source_id: int
    title: str
    summary: str = ""
    detail: str = ""
    created_at: datetime


class QuizItem(BaseModel):
    id: int
    concept_id: int
    type: str  # "flashcard" | "multiple_choice"
    prompt: str
    answer: str
    options: Optional[list[str]] = None
    created_at: datetime


class CreateSourceRequest(BaseModel):
    name: str
    url: Optional[str] = None
    raw_content: Optional[str] = None


class ReviewRequest(BaseModel):
    correct: bool
