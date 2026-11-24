import logging

from app.db import DatabaseUnavailableError, open_connection
from app.items import Item, ItemIn

logger = logging.getLogger("wardrobe.repository")

SELECT_ALL = (
    "SELECT id, name, category, color, warmth, price FROM dbo.items ORDER BY id"
)
SELECT_ONE = (
    "SELECT id, name, category, color, warmth, price FROM dbo.items WHERE id = ?"
)
INSERT_ONE = (
    "INSERT INTO dbo.items (name, category, color, warmth, price) "
    "OUTPUT INSERTED.id, INSERTED.name, INSERTED.category, INSERTED.color, "
    "INSERTED.warmth, INSERTED.price "
    "VALUES (?, ?, ?, ?, ?)"
)
UPDATE_ONE = (
    "UPDATE dbo.items SET name = ?, category = ?, color = ?, warmth = ?, price = ? "
    "OUTPUT INSERTED.id, INSERTED.name, INSERTED.category, INSERTED.color, "
    "INSERTED.warmth, INSERTED.price "
    "WHERE id = ?"
)
DELETE_ONE = "DELETE FROM dbo.items WHERE id = ?"


def row_to_item(row) -> Item:
    return Item(
        id=row[0],
        name=row[1],
        category=row[2],
        color=row[3],
        warmth=row[4],
        price=float(row[5]),
    )


def item_values(item: ItemIn) -> tuple:
    return (item.name, item.category, item.color, item.warmth, item.price)


class MemoryItemRepository:
    def __init__(self) -> None:
        self.items = {}
        self.next_id = 1

    def list_items(self) -> list[Item]:
        return list(self.items.values())

    def get_item(self, item_id: int) -> Item | None:
        return self.items.get(item_id)

    def create_item(self, new_item: ItemIn) -> Item:
        item = Item(id=self.next_id, **new_item.model_dump())
        self.items[item.id] = item
        self.next_id += 1
        return item

    def update_item(self, item_id: int, changes: ItemIn) -> Item | None:
        if item_id not in self.items:
            return None
        item = Item(id=item_id, **changes.model_dump())
        self.items[item_id] = item
        return item

    def delete_item(self, item_id: int) -> bool:
        return self.items.pop(item_id, None) is not None


class SqlItemRepository:
    def __init__(self, connection_string: str) -> None:
        self.connection_string = connection_string

    def connect(self):
        return open_connection(self.connection_string, attempts=1)

    def fetch_rows(self, sql: str, params: tuple, commit: bool = False) -> list:
        connection = self.connect()
        try:
            cursor = connection.cursor()
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            if commit:
                connection.commit()
            return rows
        except Exception as error:
            logger.error(f"database query failed: {error}")
            raise DatabaseUnavailableError("database unavailable") from error
        finally:
            connection.close()

    def list_items(self) -> list[Item]:
        items = []
        for row in self.fetch_rows(SELECT_ALL, ()):
            items.append(row_to_item(row))
        return items

    def get_item(self, item_id: int) -> Item | None:
        rows = self.fetch_rows(SELECT_ONE, (item_id,))
        if not rows:
            return None
        return row_to_item(rows[0])

    def create_item(self, new_item: ItemIn) -> Item:
        rows = self.fetch_rows(INSERT_ONE, item_values(new_item), commit=True)
        return row_to_item(rows[0])

    def update_item(self, item_id: int, changes: ItemIn) -> Item | None:
        params = item_values(changes) + (item_id,)
        rows = self.fetch_rows(UPDATE_ONE, params, commit=True)
        if not rows:
            return None
        return row_to_item(rows[0])

    def delete_item(self, item_id: int) -> bool:
        connection = self.connect()
        try:
            cursor = connection.cursor()
            cursor.execute(DELETE_ONE, (item_id,))
            deleted_count = cursor.rowcount
            connection.commit()
        except Exception as error:
            logger.error(f"database query failed: {error}")
            raise DatabaseUnavailableError("database unavailable") from error
        finally:
            connection.close()
        return deleted_count > 0
