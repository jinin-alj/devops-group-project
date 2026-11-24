import logging
import os
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.db import build_connection_string, open_connection
from app.migrations import apply_migrations

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


@asynccontextmanager
async def lifespan(application: FastAPI):
    connection_string = build_connection_string(dict(os.environ))
    if connection_string is None:
        logger.warning("DB_HOST is not set, so no migrations were run")
    else:
        run_migrations(connection_string)
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


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_NAME}
