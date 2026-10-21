"""Unit & Integration Tests for Native Vercel Python Serverless Route Handler."""
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from api.index import app
from api.config import config

client = TestClient(app)
VALID_KEY = config.SERVICE_API_KEY
FIXTURES_DIR = Path(__file__).resolve().parent.parent / "datasets" / "test_set"


def test_vercel_python_health_endpoints():
    """Verify all health endpoints return 200 without authentication."""
    for path in ["/health", "/api/health", "/api/python/health", "/"]:
        res = client.get(path)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["service"] == "trackerthings-python-serverless"
        assert "runtime" in data


def test_vercel_python_extract_requires_auth():
    """Verify unauthorized requests are blocked with HTTP 401."""
    files = {"file": ("schedule.pdf", b"%PDF-1.4 mock", "application/pdf")}
    res = client.post("/api/extract/academic", files=files)
    assert res.status_code == 401


def test_vercel_python_multipart_with_pillow_image():
    """Verify multipart image upload uses Pillow to inspect and validate image safely."""
    img = Image.new("RGB", (300, 200), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    # 1. Raw image without OCR -> Pillow inspection, insufficientForPersistence=True (honest signal)
    files = {"file": ("screenshot.png", buf.getvalue(), "image/png")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    res = client.post("/api/extract/academic", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["insufficientForPersistence"] is True
    assert "Pillow: PNG 300x200" in data["metrics"]["sourceFormat"]

    # 2. Image with preExtractedText -> extracts items
    res_ocr = client.post(
        "/api/extract/academic",
        files={"file": ("screenshot.png", buf.getvalue(), "image/png")},
        data={"preExtractedText": "Senin 08:00 - 10:30 IF253418 Rekayasa Perangkat Lunak 3"},
        headers=headers,
    )
    assert res_ocr.status_code == 200
    data_ocr = res_ocr.json()
    assert len(data_ocr["items"]) == 1
    assert data_ocr["items"][0]["namaMatkul"] == "Rekayasa Perangkat Lunak"


def test_vercel_python_multipart_pdf():
    """Verify multipart digital PDF upload parses tables and returns canonical academic items."""
    digital_pdf_path = FIXTURES_DIR / "digital_schedule.pdf"
    assert digital_pdf_path.exists(), "digital_schedule.pdf must exist"

    with open(digital_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    files = {"file": ("digital_schedule.pdf", pdf_bytes, "application/pdf")}
    headers = {"X-TrackerThings-Service-Key": VALID_KEY}

    res = client.post("/api/python/extract/academic", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["totalItems"] == 4
    assert data["insufficientForPersistence"] is False
    assert data["items"][0]["namaMatkul"] == "Rekayasa Perangkat Lunak"
    assert data["items"][0]["hari"] == "Senin"
    assert data["items"][0]["waktuMulai"] == "08:00"
    assert data["items"][0]["waktuSelesai"] == "10:30"


def test_vercel_python_json_extract_payload():
    """Verify SelfHostedServerProvider JSON payload format is processed via /extract."""
    payload = {
        "fileName": "timetable.pdf",
        "mimeType": "application/pdf",
        "text": "Senin 08:00 - 10:30 IF253418 Rekayasa Perangkat Lunak 3\nRabu 13:00 - 15:30 IF253419 Kecerdasan Buatan 3",
    }
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    res = client.post("/extract", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["documentType"] == "class_schedule"
    assert len(data["items"]) == 2
    assert data["items"][0]["namaMatkul"] == "Rekayasa Perangkat Lunak"
    assert data["items"][1]["namaMatkul"] == "Kecerdasan Buatan"


def test_vercel_python_empty_file_rejected():
    """Verify empty 0-byte file returns HTTP 400."""
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    res = client.post("/api/extract/academic", files=files, headers=headers)
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_vercel_python_unsupported_mime_rejected():
    """Verify unsupported MIME type returns HTTP 400."""
    files = {"file": ("audio.mp3", b"audio data", "audio/mpeg")}
    headers = {"Authorization": f"Bearer {VALID_KEY}"}

    res = client.post("/api/extract/academic", files=files, headers=headers)
    assert res.status_code == 400
    assert "unsupported file type" in res.json()["detail"].lower()
