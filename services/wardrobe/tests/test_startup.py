from fastapi.testclient import TestClient

from app import main


class ClosableConnection:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


def test_startup_skips_migrations_without_a_database(monkeypatch) -> None:
    monkeypatch.delenv("DB_HOST", raising=False)
    calls = []
    monkeypatch.setattr(main, "apply_migrations", calls.append)

    with TestClient(main.app) as client:
        assert client.get("/health").status_code == 200
    assert calls == []


def test_startup_applies_migrations_and_closes_the_connection(monkeypatch) -> None:
    monkeypatch.setenv("DB_HOST", "sqlserver")
    monkeypatch.setenv("DB_NAME", "wardrobe")
    monkeypatch.setenv("DB_USER", "sa")
    monkeypatch.setenv("DB_PASSWORD", "secret")
    connection = ClosableConnection()
    calls = []

    def fake_open_connection(connection_string):
        return connection

    monkeypatch.setattr(main, "open_connection", fake_open_connection)
    monkeypatch.setattr(main, "apply_migrations", calls.append)

    with TestClient(main.app):
        pass
    assert calls == [connection]
    assert connection.closed
