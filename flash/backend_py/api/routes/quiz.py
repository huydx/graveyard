"""Quiz endpoints."""
from fastapi import APIRouter

from backend_py.api.deps import StoreDep
from backend_py.models import ReviewRequest

router = APIRouter()


@router.get("/daily")
def get_daily_quiz(store: StoreDep):
    return store.get_daily_quiz_items(15)


@router.post("/items/{id}/review", status_code=204)
def record_review(id: int, body: ReviewRequest, store: StoreDep):
    store.record_review(id, body.correct)
