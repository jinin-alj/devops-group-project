import logging
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "wardrobe"}

def test_each_request_writes_one_log_line(caplog) -> None:
    caplog.set_level(logging.INFO, logger="wardrobe.requests")
    client.get("/health")
    request_lines = []
    for record in caplog.records:
        if record.name == "wardrobe.requests":
            request_lines.append(record.getMessage())
    assert len(request_lines) == 1
    assert "method=GET" in request_lines[0]
    assert "path=/health" in request_lines[0]
    assert "status=200" in request_lines[0]
    assert "duration_ms=" in request_lines[0]

def test_unknown_path_is_logged_with_404(caplog) -> None:
    caplog.set_level(logging.INFO, logger="wardrobe.requests")
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    assert "status=404" in caplog.records[-1].getMessage()