import logging
from pathlib import Path

logger = logging.getLogger("wardrobe.migrations")

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

CREATE_HISTORY_TABLE = """
IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.schema_migrations (
        version NVARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
END
"""


def split_statements(sql: str) -> list[str]:
    # SQL Server tools treat a line with only GO as the end of a batch, so we do too.
    statements = []
    current_lines = []
    for line in sql.splitlines():
        if line.strip().upper() == "GO":
            statements.append("\n".join(current_lines).strip())
            current_lines = []
        else:
            current_lines.append(line)
    statements.append("\n".join(current_lines).strip())

    non_empty = []
    for statement in statements:
        if statement:
            non_empty.append(statement)
    return non_empty


def apply_migrations(connection, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    cursor = connection.cursor()
    cursor.execute(CREATE_HISTORY_TABLE)
    connection.commit()

    applied = []
    for migration in sorted(migrations_dir.glob("*.sql")):
        version = migration.name
        already_applied = cursor.execute(
            "SELECT 1 FROM dbo.schema_migrations WHERE version = ?", version
        ).fetchone()
        if already_applied:
            continue

        try:
            for statement in split_statements(migration.read_text()):
                cursor.execute(statement)
            cursor.execute(
                "INSERT INTO dbo.schema_migrations (version) VALUES (?)", version
            )
            connection.commit()
        except Exception as error:
            connection.rollback()
            raise RuntimeError(f"Migration {version} failed") from error

        logger.info(f"applied migration {version}")
        applied.append(version)
    return applied
