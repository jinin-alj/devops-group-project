import pytest
from fastapi.testclient import TestClient

from app.db import DatabaseUnavailableError
from app.main import app

JEANS = {
    "name": "Blue jeans",
    "category": "bottom",
    "color": "#1f3a93",
    "warmth": 3,
    "price": 49.99,
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("DB_HOST", raising=False)
    with TestClient(app) as test_client:
        yield test_client


def test_create_returns_the_item_with_an_id(client) -> None:
    response = client.post("/items", json=JEANS)
    assert response.status_code == 201
    created = response.json()
    assert created["id"] == 1
    assert created["name"] == "Blue jeans"


def test_list_and_get_return_saved_items(client) -> None:
    client.post("/items", json=JEANS)
    assert len(client.get("/items").json()) == 1
    assert client.get("/items/1").json()["color"] == "#1f3a93"


def test_unknown_id_returns_404(client) -> None:
    assert client.get("/items/99").status_code == 404
    assert client.put("/items/99", json=JEANS).status_code == 404
    assert client.delete("/items/99").status_code == 404


def test_update_replaces_the_item(client) -> None:
    client.post("/items", json=JEANS)
    changes = dict(JEANS)
    changes["price"] = 20
    response = client.put("/items/1", json=changes)
    assert response.status_code == 200
    assert response.json()["price"] == 20


def test_delete_returns_204_and_removes_the_item(client) -> None:
    client.post("/items", json=JEANS)
    response = client.delete("/items/1")
    assert response.status_code == 204
    assert client.get("/items/1").status_code == 404


def test_invalid_input_returns_422_naming_the_field(client) -> None:
    bad_item = dict(JEANS)
    bad_item["warmth"] = 9
    response = client.post("/items", json=bad_item)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "warmth"]


def test_database_outage_returns_a_clear_503(client, monkeypatch) -> None:
    def broken_list_items():
        raise DatabaseUnavailableError("database unavailable")

    monkeypatch.setattr(app.state.item_repository, "list_items", broken_list_items)
    response = client.get("/items")
    assert response.status_code == 503
    assert response.json() == {
        "detail": "wardrobe database unavailable, try again later"
    }
