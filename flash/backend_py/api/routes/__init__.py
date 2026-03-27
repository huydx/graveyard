"""API route modules."""
from fastapi import APIRouter

from .notion import router as notion_router
from .quiz import router as quiz_router
from .sources import router as sources_router

router = APIRouter()
router.include_router(sources_router, prefix="/sources", tags=["sources"])
router.include_router(quiz_router, prefix="/quiz", tags=["quiz"])
router.include_router(notion_router, prefix="/notion", tags=["notion"])
