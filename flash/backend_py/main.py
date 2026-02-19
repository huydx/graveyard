"""Flash API entrypoint: FastAPI app, lifespan, CORS, routes."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend_py.api import router
from backend_py.api.deps import set_store
from backend_py.db import Store

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = Store()
    set_store(store)
    try:
        yield
    finally:
        store.close()
        set_store(None)


app = FastAPI(title="Flash API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_py.main:app", host="0.0.0.0", port=8080, reload=True)
