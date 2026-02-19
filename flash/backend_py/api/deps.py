"""Request dependencies: store, config."""
from typing import Annotated

from fastapi import Depends

from backend_py.config import get_settings
from backend_py.db import Store

_store: Store | None = None


def set_store(store: Store | None) -> None:
    global _store
    _store = store


def get_store() -> Store:
    if _store is None:
        raise RuntimeError("store not initialized")
    return _store


def get_config():
    return get_settings()


StoreDep = Annotated[Store, Depends(get_store)]
