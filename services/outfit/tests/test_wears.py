from datetime import date, timedelta

import httpx
from fastapi.testclient import TestClient

from app.main import app


def test_post_wears_persists_items() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/wears",
            json={"item_ids": [1, 2], "worn_on": "2026-11-23"},
        )

    assert response.status_code == 201
    assert response.json() == {
        "item_ids": [1, 2],
        "worn_on": "2026-11-23",
    }


def test_post_wears_rejects_future_date() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/wears",
            json={
                "item_ids": [1],
                "worn_on": (date.today() + timedelta(days=1)).isoformat(),
            },
        )

    assert response.status_code == 422


def test_post_wears_rejects_invalid_item_ids() -> None:
    with TestClient(app) as client:
        response = client.post("/wears", json={"item_ids": [0]})

    assert response.status_code == 422


def test_cost_stats_return_clear_503_when_wardrobe_is_unavailable(
    monkeypatch,
) -> None:
    class UnavailableClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            pass

        async def get(self, *args, **kwargs):
            raise httpx.RequestError("connection failed")

    monkeypatch.setattr("app.main.httpx.AsyncClient", UnavailableClient)

    with TestClient(app) as client:
        response = client.get("/stats/cost-per-wear")

    assert response.status_code == 503
    assert response.json()["detail"] == "wardrobe unavailable, try again later"


def test_unworn_stats_return_clear_503_on_timeout(monkeypatch) -> None:
    class TimeoutClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args) -> None:
            pass

        async def get(self, *args, **kwargs):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr("app.main.httpx.AsyncClient", TimeoutClient)

    with TestClient(app) as client:
        response = client.get("/stats/unworn")

    assert response.status_code == 503
    assert response.json()["detail"] == "wardrobe unavailable, try again later"
