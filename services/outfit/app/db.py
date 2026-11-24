import os
from datetime import date
from pathlib import Path
from typing import Protocol


class WearRepository(Protocol):
    def add_wears(self, item_ids: list[int], worn_on: date) -> None: ...

    def get_wears(self) -> list[tuple[int, date]]: ...


class MemoryWearRepository:
    def __init__(self) -> None:
        self._wears: list[tuple[int, date]] = []

    def add_wears(self, item_ids: list[int], worn_on: date) -> None:
        self._wears.extend((item_id, worn_on) for item_id in item_ids)

    def get_wears(self) -> list[tuple[int, date]]:
        return list(self._wears)


class SqlWearRepository:
    def __init__(self, connection_string: str) -> None:
        self.connection_string = connection_string

    def _connect(self):
        import pyodbc

        return pyodbc.connect(self.connection_string)

    def add_wears(self, item_ids: list[int], worn_on: date) -> None:
        with self._connect() as connection:
            cursor = connection.cursor()
            cursor.fast_executemany = True
            cursor.executemany(
                "INSERT INTO wears (item_id, worn_on) VALUES (?, ?)",
                [(item_id, worn_on) for item_id in item_ids],
            )

    def get_wears(self) -> list[tuple[int, date]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT item_id, worn_on FROM wears").fetchall()
        return [(int(row.item_id), row.worn_on) for row in rows]


def apply_migrations(connection_string: str) -> None:
    import pyodbc

    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    with pyodbc.connect(connection_string) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.schema_migrations (
                    version NVARCHAR(255) NOT NULL PRIMARY KEY,
                    applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                )
            END
            """
        )

        for migration in sorted(migrations_dir.glob("*.sql")):
            version = migration.name
            row = cursor.execute(
                "SELECT 1 FROM dbo.schema_migrations WHERE version = ?",
                version,
            ).fetchone()
            if row:
                continue
            sql = migration.read_text()
            for statement in sql.split("\nGO\n"):
                statement = statement.strip()
                if statement:
                    cursor.execute(statement)
            cursor.execute(
                "INSERT INTO dbo.schema_migrations (version) VALUES (?)",
                version,
            )
            connection.commit()


def build_connection_string() -> str | None:
    host = os.environ.get("DB_HOST")
    if not host:
        return None
    password = os.environ["DB_PASSWORD"].replace("}", "}}")
    trust_certificate = os.environ.get("DB_TRUST_SERVER_CERTIFICATE", "no")
    return (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER=tcp:{host},1433;"
        f"DATABASE={os.environ['DB_NAME']};"
        f"UID={os.environ['DB_USER']};"
        f"PWD={{{password}}};"
        "Encrypt=yes;"
        f"TrustServerCertificate={trust_certificate};"
        "Connection Timeout=30;"
    )


def create_repository() -> WearRepository:
    connection_string = build_connection_string()
    if not connection_string:
        return MemoryWearRepository()
    if not os.environ.get("SKIP_MIGRATIONS"):
        apply_migrations(connection_string)
    return SqlWearRepository(connection_string)
