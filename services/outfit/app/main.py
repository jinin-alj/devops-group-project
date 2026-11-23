import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import date
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from app.db import WearRepository, create_repository
from app.stats import cost_per_wear, unworn_items

SERVICE_NAME = "outfit"
WARDROBE_SERVICE_URL = os.environ.get(
    "WARDROBE_SERVICE_URL",
    "http://wardrobe:8000",
)
WARDROBE_TIMEOUT_SECONDS = 3.0

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")
request_logger = logging.getLogger(f"{SERVICE_NAME}.requests")


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.wear_repository = create_repository()
    yield


app = FastAPI(title="outfit-service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ALLOWED_ORIGIN", "http://localhost:8080")],
    allow_methods=["*"],
    allow_headers=["*"],
)


# each service builds its own image, so the wardrobe service keeps its own copy of this
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


class WearRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)
    worn_on: date = Field(default_factory=date.today)

    @field_validator("item_ids")
    @classmethod
    def item_ids_must_be_positive(cls, item_ids: list[int]) -> list[int]:
        if any(item_id <= 0 for item_id in item_ids):
            raise ValueError("item ids must be positive integers")
        return item_ids

    @field_validator("worn_on")
    @classmethod
    def worn_on_must_not_be_in_the_future(cls, worn_on: date) -> date:
        if worn_on > date.today():
            raise ValueError("worn_on cannot be in the future")
        return worn_on


def get_repository() -> WearRepository:
    return app.state.wear_repository


@app.post("/wears", status_code=status.HTTP_201_CREATED)
def log_wears(wear: WearRequest) -> dict:
    get_repository().add_wears(wear.item_ids, wear.worn_on)
    return {"item_ids": wear.item_ids, "worn_on": wear.worn_on.isoformat()}


async def fetch_wardrobe_items() -> list[dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=WARDROBE_TIMEOUT_SECONDS) as client:
            response = await client.get(f"{WARDROBE_SERVICE_URL}/items")
            response.raise_for_status()
            items = response.json()
    except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="wardrobe unavailable, try again later",
        ) from error

    if not isinstance(items, list):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="wardrobe unavailable, try again later",
        )
    return items


@app.get("/stats/cost-per-wear")
async def get_cost_per_wear() -> list[dict[str, Any]]:
    items = await fetch_wardrobe_items()
    wears = get_repository().get_wears()
    return cost_per_wear(items, wears)


@app.get("/stats/unworn")
async def get_unworn_items() -> list[dict[str, Any]]:
    items = await fetch_wardrobe_items()
    wears = get_repository().get_wears()
    return unworn_items(items, wears)
