from decimal import Decimal

import pytest

from app import repository
from app.db import DatabaseUnavailableError
from app.items import ItemIn

JEANS_ROW = (1, "Blue jeans", "bottom", "#1f3a93", 3, Decimal("49.99"))
JEANS = ItemIn(
    name="Blue jeans", category="bottom", color="#1f3a93", warmth=3, price=49.99
)


class FakeCursor:
    def __init__(self, connection) -> None:
        self.connection = connection
        self.rowcount = connection.rowcount

    def execute(self, sql: str, params: tuple) -> None:
        if self.connection.error:
            raise self.connection.error
        self.connection.queries.append((sql, params))

    def fetchall(self) -> list:
        return self.connection.rows


class FakeConnection:
    def __init__(self, rows=None, rowcount=0, error=None) -> None:
        self.rows = rows or []
        self.rowcount = rowcount
        self.error = error
        self.queries = []
        self.committed = False
        self.closed = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)

    def commit(self) -> None:
        self.committed = True

    def close(self) -> None:
        self.closed = True


def use_connection(monkeypatch, connection: FakeConnection):
    def fake_open_connection(connection_string, attempts):
        return connection

    monkeypatch.setattr(repository, "open_connection", fake_open_connection)
    return repository.SqlItemRepository("conn")


def test_list_turns_rows_into_items(monkeypatch) -> None:
    connection = FakeConnection(rows=[JEANS_ROW])
    items = use_connection(monkeypatch, connection).list_items()
    assert items[0].name == "Blue jeans"
    assert items[0].price == 49.99
    assert connection.closed


def test_get_unknown_item_returns_none(monkeypatch) -> None:
    connection = FakeConnection(rows=[])
    assert use_connection(monkeypatch, connection).get_item(5) is None
    assert connection.queries[0][1] == (5,)


def test_create_sends_values_as_parameters_and_commits(monkeypatch) -> None:
    connection = FakeConnection(rows=[JEANS_ROW])
    item = use_connection(monkeypatch, connection).create_item(JEANS)
    sql, params = connection.queries[0]
    assert "VALUES (?, ?, ?, ?, ?)" in sql
    assert params == ("Blue jeans", "bottom", "#1f3a93", 3, 49.99)
    assert item.id == 1
    assert connection.committed


def test_update_unknown_item_returns_none(monkeypatch) -> None:
    connection = FakeConnection(rows=[])
    repo = use_connection(monkeypatch, connection)
    assert repo.update_item(7, JEANS) is None
    assert connection.queries[0][1][-1] == 7


def test_update_returns_the_new_values(monkeypatch) -> None:
    connection = FakeConnection(rows=[JEANS_ROW])
    assert use_connection(monkeypatch, connection).update_item(1, JEANS).id == 1


@pytest.mark.parametrize("rowcount, expected", [(1, True), (0, False)])
def test_delete_reports_whether_a_row_was_removed(
    monkeypatch, rowcount: int, expected: bool
) -> None:
    connection = FakeConnection(rowcount=rowcount)
    assert use_connection(monkeypatch, connection).delete_item(1) is expected
    assert connection.committed


def test_query_errors_become_database_unavailable(monkeypatch) -> None:
    connection = FakeConnection(error=OSError("connection reset"))
    repo = use_connection(monkeypatch, connection)
    with pytest.raises(DatabaseUnavailableError):
        repo.list_items()
    with pytest.raises(DatabaseUnavailableError):
        repo.delete_item(1)
    assert connection.closed


def test_memory_repository_supports_the_same_calls() -> None:
    repo = repository.MemoryItemRepository()
    created = repo.create_item(JEANS)
    assert repo.get_item(created.id) == created
    assert repo.update_item(created.id, JEANS).id == created.id
    assert repo.delete_item(created.id)
    assert repo.list_items() == []
