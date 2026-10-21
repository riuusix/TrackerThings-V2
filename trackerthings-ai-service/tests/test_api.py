"""Unit & Integration Tests for TrackerThings AI Microservice."""
import io
import pytest
from fastapi.testclient import TestClient
from main import app
from app.config import settings

client = TestClient(app)
VALID_KEY = settings.SERVICE_API_KEY


def test_health_check_public_no_auth():
    """Verify /health is accessible without any authentication headers."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "trackerthings-ai-service"
    assert "version" in data


def test_root_public_no_auth():
    """Verify / returns service info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_extract_requires_authentication():
    """Ensure unauthenticated extraction requests are rejected with HTTP 401."""
    files = {"file": ("test.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    response = client.post("/api/extract/academic", files=files)
    assert response.status_code == 401
    assert "detail" in response.json()


def test_extract_rejects_invalid_api_key():
    """Ensure invalid service key is rejected with HTTP 401."""
    files = {"file": ("test.pdf", b"%PDF-1.4 mock content", "application/pdf")}
    headers = {"Authorization": "Bearer wrong_invalid_key_12345"}
    response = client.post("/api/extract/academic", files=files, headers=headers)
    assert response.status_code == 401


def test_extract_succeeds_with_bearer_token():
    """Verify valid Bearer token permits extraction and returns Canonical Academic Schema."""
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Title (Jadwal Kuliah UNAS) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
    files = {"file": ("krs_siakad.pdf", pdf_bytes, "application/pdf")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    response = client.post("/api/extract/academic", files=files, headers=headers)
    assert response.status_code == 200

    data = response.json()
    # Validate top-level CanonicalAcademicExtractionResult fields
    assert data["documentType"] == "class_schedule"
    assert "items" in data
    assert data["totalItems"] == len(data["items"])
    assert data["needsReviewCount"] == 0
    assert data["insufficientForPersistence"] is False
    assert "metrics" in data
    assert data["metrics"]["sourceFormat"] == "pdf_text"

    # Validate CanonicalAcademicItem item structure
    items = data["items"]
    assert len(items) >= 2
    first = items[0]
    assert first["namaMatkul"] == "Rekayasa Perangkat Lunak"
    assert first["kodeMatkul"] == "IF253418"
    assert first["hari"] == "Senin"
    assert first["waktuMulai"] == "08:00"
    assert first["waktuSelesai"] == "10:30"
    assert first["sks"] == 3
    assert first["needsReview"] is False
    assert "namaMatkul" in first["fieldValidations"]
    assert first["fieldValidations"]["namaMatkul"]["status"] == "valid"


def test_extract_succeeds_with_service_key_header():
    """Verify X-TrackerThings-Service-Key custom header is also supported."""
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("screenshot_jadwal.png", png_bytes, "image/png")}
    headers = {"X-TrackerThings-Service-Key": VALID_KEY}

    response = client.post("/api/extract/academic", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["sourceFormat"] == "image_png"


def test_extract_rejects_empty_file():
    """Verify 0-byte file upload returns HTTP 400 Bad Request."""
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    response = client.post("/api/extract/academic", files=files, headers=headers)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_extract_rejects_unsupported_mime():
    """Verify unsupported MIME types (e.g. text/plain, video/mp4) return HTTP 400."""
    files = {"file": ("notes.txt", b"Random text notes", "text/plain")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    response = client.post("/api/extract/academic", files=files, headers=headers)
    assert response.status_code == 400
    assert "unsupported file type" in response.json()["detail"].lower()


def test_legacy_extract_alias_route():
    """Verify /extract alias works identically for SelfHostedServerProvider."""
    pdf_bytes = b"%PDF-1.4 mock content"
    files = {"file": ("timetable.pdf", pdf_bytes, "application/pdf")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    response = client.post("/extract", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["totalItems"] > 0

