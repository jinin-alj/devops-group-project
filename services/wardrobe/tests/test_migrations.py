import pytest

from app.migrations import apply_migrations, split_statements


class FakeCursor:
    def __init__(self, connection) -> None:
        self.connection = connection
        self.last_row = None

    def execute(self, sql: str, *params):
        self.connection.executed.append(sql.strip())
        self.last_row = None
        if "SELECT 1 FROM dbo.schema_migrations" in sql:
            if params[0] in self.connection.applied:
                self.last_row = (1,)
        if "INSERT INTO dbo.schema_migrations" in sql:
            self.connection.applied.append(params[0])
        if self.connection.fail_on and self.connection.fail_on in sql:
            raise RuntimeError("bad sql")
        return self

    def fetchone(self):
        return self.last_row


class FakeConnection:
    def __init__(self, applied=None, fail_on=None) -> None:
        self.applied = applied or []
        self.fail_on = fail_on
        self.executed = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


@pytest.fixture
def migrations_dir(tmp_path):
    (tmp_path / "002_second.sql").write_text("CREATE TABLE second (id INT)")
    (tmp_path / "001_first.sql").write_text(
        "CREATE TABLE first (id INT)\nGO\nCREATE INDEX ix ON first (id)\n"
    )
    return tmp_path


def test_migrations_run_in_file_name_order(migrations_dir) -> None:
    connection = FakeConnection()
    applied = apply_migrations(connection, migrations_dir)
    assert applied == ["001_first.sql", "002_second.sql"]
    assert connection.applied == ["001_first.sql", "002_second.sql"]
    assert connection.commits == 3


def test_already_applied_migrations_are_skipped(migrations_dir) -> None:
    connection = FakeConnection(applied=["001_first.sql"])
    applied = apply_migrations(connection, migrations_dir)
    assert applied == ["002_second.sql"]
    assert "CREATE TABLE first (id INT)" not in connection.executed


def test_a_failed_migration_is_rolled_back_and_not_recorded(migrations_dir) -> None:
    connection = FakeConnection(fail_on="CREATE TABLE second")
    with pytest.raises(RuntimeError, match="002_second.sql"):
        apply_migrations(connection, migrations_dir)
    assert connection.rollbacks == 1
    assert connection.applied == ["001_first.sql"]


def test_go_lines_split_a_file_into_batches() -> None:
    sql = "CREATE TABLE a (id INT)\ngo\n\nCREATE TABLE b (id INT)\nGO\n"
    assert split_statements(sql) == [
        "CREATE TABLE a (id INT)",
        "CREATE TABLE b (id INT)",
    ]


def test_the_real_migrations_folder_has_the_items_table() -> None:
    connection = FakeConnection()
    applied = apply_migrations(connection)
    assert applied[0] == "001_create_items.sql"
    assert any("CREATE TABLE dbo.items" in sql for sql in connection.executed)
