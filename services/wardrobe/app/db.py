import logging
import time

logger = logging.getLogger("wardrobe.db")

REQUIRED_SETTINGS = ["DB_NAME", "DB_USER", "DB_PASSWORD"]

# A paused serverless database in Azure can take about a minute to wake up.
STARTUP_ATTEMPTS = 10
STARTUP_WAIT_SECONDS = 10


class DatabaseUnavailableError(Exception):
    pass


def build_connection_string(settings: dict) -> str | None:
    host = settings.get("DB_HOST")
    if not host:
        return None

    missing = []
    for name in REQUIRED_SETTINGS:
        if not settings.get(name):
            missing.append(name)
    if missing:
        raise RuntimeError(f"Missing database settings: {', '.join(missing)}")

    # Wrapping the password in braces lets it contain semicolons.
    password = settings["DB_PASSWORD"].replace("}", "}}")
    trust_certificate = settings.get("DB_TRUST_SERVER_CERTIFICATE", "no")

    return (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER=tcp:{host},1433;"
        f"DATABASE={settings['DB_NAME']};"
        f"UID={settings['DB_USER']};"
        f"PWD={{{password}}};"
        "Encrypt=yes;"
        f"TrustServerCertificate={trust_certificate};"
        "Connection Timeout=30;"
    )


def driver_connect(connection_string: str):
    # Imported here so the tests run on machines without the ODBC driver.
    import pyodbc

    return pyodbc.connect(connection_string)


def open_connection(
    connection_string: str,
    attempts: int = STARTUP_ATTEMPTS,
    wait_seconds: float = STARTUP_WAIT_SECONDS,
):
    for attempt in range(1, attempts + 1):
        try:
            return driver_connect(connection_string)
        except Exception as error:
            logger.warning(f"database attempt {attempt} of {attempts} failed: {error}")
            if attempt == attempts:
                raise DatabaseUnavailableError("database unavailable") from error
            time.sleep(wait_seconds)
