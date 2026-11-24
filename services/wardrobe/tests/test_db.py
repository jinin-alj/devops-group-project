import pytest

from app import db

FULL_SETTINGS = {
    "DB_HOST": "sdd.database.windows.net",
    "DB_NAME": "sdd-wardrobe-db",
    "DB_USER": "sqladmin",
    "DB_PASSWORD": "secret",
}


def test_no_host_means_no_database() -> None:
    assert db.build_connection_string({}) is None


def test_connection_string_uses_every_setting() -> None:
    connection_string = db.build_connection_string(FULL_SETTINGS)
    assert "SERVER=tcp:sdd.database.windows.net,1433;" in connection_string
    assert "DATABASE=sdd-wardrobe-db;" in connection_string
    assert "UID=sqladmin;" in connection_string
    assert "PWD={secret};" in connection_string
    assert "Encrypt=yes;" in connection_string
    assert "TrustServerCertificate=no;" in connection_string


def test_local_setup_can_trust_the_self_signed_certificate() -> None:
    settings = dict(FULL_SETTINGS)
    settings["DB_TRUST_SERVER_CERTIFICATE"] = "yes"
    connection_string = db.build_connection_string(settings)
    assert "TrustServerCertificate=yes;" in connection_string


def test_password_braces_are_escaped() -> None:
    settings = dict(FULL_SETTINGS)
    settings["DB_PASSWORD"] = "a}b;c"
    connection_string = db.build_connection_string(settings)
    assert "PWD={a}}b;c};" in connection_string


def test_missing_settings_are_named_in_the_error() -> None:
    with pytest.raises(RuntimeError, match="DB_USER, DB_PASSWORD"):
        db.build_connection_string({"DB_HOST": "host", "DB_NAME": "wardrobe"})


def test_open_connection_retries_until_the_database_answers(monkeypatch) -> None:
    attempts = []

    def flaky_connect(connection_string):
        attempts.append(connection_string)
        if len(attempts) < 3:
            raise OSError("database is still waking up")
        return "connection"

    monkeypatch.setattr(db, "driver_connect", flaky_connect)
    connection = db.open_connection("conn", attempts=5, wait_seconds=0)
    assert connection == "connection"
    assert len(attempts) == 3


def test_open_connection_gives_up_after_the_last_attempt(monkeypatch) -> None:
    def broken_connect(connection_string):
        raise OSError("no database")

    monkeypatch.setattr(db, "driver_connect", broken_connect)
    with pytest.raises(db.DatabaseUnavailableError):
        db.open_connection("conn", attempts=2, wait_seconds=0)
