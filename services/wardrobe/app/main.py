import logging
import os
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.db import DatabaseUnavailableError, build_connection_string, open_connection
from app.items import Item, ItemIn
from app.migrations import apply_migrations
from app.repository import MemoryItemRepository, SqlItemRepository

SERVICE_NAME = "wardrobe"

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")
logger = logging.getLogger(SERVICE_NAME)
request_logger = logging.getLogger(f"{SERVICE_NAME}.requests")


def run_migrations(connection_string: str) -> None:
    connection = open_connection(connection_string)
    try:
        apply_migrations(connection)
    finally:
        connection.close()


def create_repository():
    connection_string = build_connection_string(dict(os.environ))
    if connection_string is None:
        logger.warning("DB_HOST is not set, so items are only kept in memory")
        return MemoryItemRepository()
    run_migrations(connection_string)
    return SqlItemRepository(connection_string)


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.item_repository = create_repository()
    yield


app = FastAPI(title="wardrobe-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:8080")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request(request: Request, call_next) -> Response:
    start_time = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000
        request_logger.info(
            f"method={request.method} path={request.url.path} "
            f"status={status_code} duration_ms={duration_ms:.1f}"
        )


@app.exception_handler(DatabaseUnavailableError)
async def database_unavailable(request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "wardrobe database unavailable, try again later"},
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}


def get_repository(request: Request):
    return request.app.state.item_repository


def item_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="item not found")


@app.get("/items")
def list_items(request: Request) -> list[Item]:
    return get_repository(request).list_items()


@app.get("/items/{item_id}")
def get_item(item_id: int, request: Request) -> Item:
    item = get_repository(request).get_item(item_id)
    if item is None:
        raise item_not_found()
    return item


@app.post("/items", status_code=status.HTTP_201_CREATED)
def create_item(new_item: ItemIn, request: Request) -> Item:
    return get_repository(request).create_item(new_item)


@app.put("/items/{item_id}")
def update_item(item_id: int, changes: ItemIn, request: Request) -> Item:
    item = get_repository(request).update_item(item_id, changes)
    if item is None:
        raise item_not_found()
    return item


@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, request: Request) -> Response:
    if not get_repository(request).delete_item(item_id):
        raise item_not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
