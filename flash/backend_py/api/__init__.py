"""HTTP API: dependencies and route modules."""
from .deps import get_store
from .routes import router

__all__ = ["get_store", "router"]
