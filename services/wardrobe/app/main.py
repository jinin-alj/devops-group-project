import logging
import sys
import time
from fastapi import FastAPI, Request, Response

SERVICE_NAME = "wardrobe"

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(message)s")
request_logger = logging.getLogger(f"{SERVICE_NAME}.requests")

app = FastAPI(title="wardrobe-service")

# the outfit service has the same middleware on purpose
@app.middleware("http")
async def log_request(request: Request, call_next) -> Response:
    """Write one log line per request with method, path, status and duration."""
    start_time = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000
        request_logger.info(
            f"method={request.method} path={request.url.path} "
            f"status={status_code} duration_ms={duration_ms:.1f}"
        )

@app.get("/health")
def health() -> dict:
    """Report that the service is up."""
    return {"status": "ok", "service": SERVICE_NAME}