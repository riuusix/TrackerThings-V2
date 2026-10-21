"""Vercel Native Serverless Entrypoint for TrackerThings V2 AI Intelligence."""
import io
import os
import sys
import time
from pathlib import Path
from typing import Optional

# Ensure the 'api' directory is on Python path for Vercel Serverless environment
CURRENT_DIR = Path(__file__).resolve().parent
PARENT_DIR = CURRENT_DIR.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from api.auth import verify_service_auth
from api.config import config
from api.extractor import extract_academic_document, extract_from_delimited_text
from api.schemas import (
    AcademicDocumentType,
    AcademicJsonExtractRequest,
    AcademicRecurrenceType,
    CanonicalAcademicExtractionResult,
    CanonicalAcademicItem,
    ExtractionMetrics,
    FieldValidationInfo,
    FieldValidationLevel,
    ProvenanceInfo,
)

app = FastAPI(
    title="TrackerThings Native Vercel Python AI Service",
    description="Vercel Native Serverless Route for specialized academic timetable and document extraction.",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Health Check Routes
# -----------------------------------------------------------------------------

@app.get("/health", summary="Health Check")
@app.get("/api/health", summary="API Health Check")
@app.get("/api/python/health", summary="Python Route Health Check")
@app.get("/", summary="Root Health Check")
async def health_check():
    """Uptime health check route for Vercel and Next.js SelfHostedServerProvider."""
    return {
        "status": "ok",
        "service": "trackerthings-python-serverless",
        "version": "2.0.0",
        "runtime": f"python-{sys.version.split()[0]}",
        "environment": config.ENVIRONMENT,
    }


# -----------------------------------------------------------------------------
# Academic Extraction Handlers
# -----------------------------------------------------------------------------

async def _handle_multipart_upload(
    file: UploadFile,
    preExtractedText: Optional[str] = None,
) -> CanonicalAcademicExtractionResult:
    content_type = file.content_type or "application/octet-stream"
    if content_type.lower() not in [m.lower() for m in config.ALLOWED_MIME_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed: {', '.join(config.ALLOWED_MIME_TYPES)}",
        )

    # In-memory RAM buffer read
    contents = await file.read()
    file_size_bytes = len(contents)

    if file_size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded document is empty (0 bytes).",
        )

    max_bytes = config.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {config.MAX_FILE_SIZE_MB}MB limit.",
        )

    return extract_academic_document(
        contents=contents,
        filename=file.filename or "document",
        content_type=content_type,
        pre_extracted_text=preExtractedText,
    )


@app.post(
    "/api/extract/academic",
    response_model=CanonicalAcademicExtractionResult,
    summary="Extract Academic Timetable from Document (Multipart)",
    dependencies=[Depends(verify_service_auth)],
)
@app.post(
    "/api/python/extract/academic",
    response_model=CanonicalAcademicExtractionResult,
    summary="Extract Academic Timetable from Document (Multipart) under /api/python",
    dependencies=[Depends(verify_service_auth)],
)
async def extract_academic_multipart(
    file: UploadFile = File(..., description="Academic PDF or image file (PNG, JPG, WebP)"),
    preExtractedText: Optional[str] = Form(default=None),
):
    """Main multipart document extraction endpoint."""
    return await _handle_multipart_upload(file, preExtractedText)


@app.post(
    "/extract",
    response_model=CanonicalAcademicExtractionResult,
    summary="Extract Academic Document via JSON or Multipart",
    dependencies=[Depends(verify_service_auth)],
)
@app.post(
    "/api/python/extract",
    response_model=CanonicalAcademicExtractionResult,
    summary="Extract Academic Document via JSON under /api/python",
    dependencies=[Depends(verify_service_auth)],
)
async def extract_academic_json_or_alias(req: Request):
    """Supports both JSON payload from SelfHostedServerProvider and multipart uploads."""
    content_type = req.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await req.form()
        file = form.get("file")
        if not file or not isinstance(file, UploadFile):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Form data must contain a valid 'file' upload.",
            )
        pre_text = form.get("preExtractedText")
        return await _handle_multipart_upload(file, str(pre_text) if pre_text else None)

    elif "application/json" in content_type:
        try:
            body = await req.json()
            json_req = AcademicJsonExtractRequest(**body)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON payload: {str(e)}",
            )
        text_content = json_req.text or ""
        return extract_from_delimited_text(text_content, method="text_stream")

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Content-Type must be 'multipart/form-data' or 'application/json'.",
    )
