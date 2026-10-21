"""Academic document extraction routes for TrackerThings AI Microservice."""
import time
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.auth import verify_service_auth
from app.config import settings
from app.schemas import (
    AcademicDocumentType,
    AcademicRecurrenceType,
    CanonicalAcademicExtractionResult,
    CanonicalAcademicItem,
    ExtractionMetrics,
    FieldValidationInfo,
    FieldValidationLevel,
    ProvenanceInfo,
)

router = APIRouter(tags=["Academic Extraction"])


def _detect_source_format(filename: str, content_type: Optional[str]) -> str:
    ct = (content_type or "").lower()
    fn = (filename or "").lower()
    if "pdf" in ct or fn.endswith(".pdf"):
        return "pdf_text"
    elif "png" in ct or fn.endswith(".png"):
        return "image_png"
    elif "jpeg" in ct or "jpg" in ct or fn.endswith(".jpg") or fn.endswith(".jpeg"):
        return "image_jpeg"
    return "synthetic"


async def _process_academic_extraction(
    file: UploadFile,
    preExtractedText: Optional[str] = None,
) -> CanonicalAcademicExtractionResult:
    start_time = time.perf_counter()

    # 1. Validate MIME type
    content_type = file.content_type or "application/octet-stream"
    if content_type.lower() not in [m.lower() for m in settings.ALLOWED_MIME_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed MIME types: {', '.join(settings.ALLOWED_MIME_TYPES)}",
        )

    # 2. Read in-memory (RAM only — never persist user documents to disk)
    contents = await file.read()
    file_size_bytes = len(contents)

    if file_size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded document is empty (0 bytes).",
        )

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({file_size_bytes / (1024 * 1024):.2f} MB) exceeds maximum limit of {settings.MAX_FILE_SIZE_MB} MB.",
        )

    # 3. Baseline skeleton implementation (conforms strictly to TrackerThings Canonical Schema)
    # Heavy OCR and Vision models will be plugged here in subsequent iterations
    source_format = _detect_source_format(file.filename or "", content_type)
    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Standard representative canonical schedule items
    dummy_items = [
        CanonicalAcademicItem(
            id="item_demo_1",
            namaMatkul="Rekayasa Perangkat Lunak",
            kodeMatkul="IF253418",
            kelas="R.01",
            hari="Senin",
            tanggal=None,
            waktuMulai="08:00",
            waktuSelesai="10:30",
            lokasi="D.302 VA",
            dosen="Dr. Ir. Budi Rahardjo, M.T.",
            sks=3,
            kategori="Wajib",
            recurrence=AcademicRecurrenceType.WEEKLY,
            needsReview=False,
            warnings=[],
            fieldValidations={
                "namaMatkul": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.98
                ),
                "hari": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.99
                ),
                "waktuMulai": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.97
                ),
                "waktuSelesai": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.97
                ),
                "sks": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=1.00
                ),
            },
            provenance=ProvenanceInfo(
                rawTextSnippet="Senin 08:00 10:30 D.302 VA IF253418 R.01 Rekayasa Perangkat Lunak 3",
                pageIndex=1,
                extractionMethod="ml_inferred",
            ),
        ),
        CanonicalAcademicItem(
            id="item_demo_2",
            namaMatkul="Kecerdasan Buatan",
            kodeMatkul="IF253419",
            kelas="R.02",
            hari="Rabu",
            tanggal=None,
            waktuMulai="13:00",
            waktuSelesai="15:30",
            lokasi="Lab. Data Science",
            dosen="Prof. Dr. Eng. Siti Aminah, M.Kom.",
            sks=3,
            kategori="Wajib",
            recurrence=AcademicRecurrenceType.WEEKLY,
            needsReview=False,
            warnings=[],
            fieldValidations={
                "namaMatkul": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.95
                ),
                "hari": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.98
                ),
                "waktuMulai": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.96
                ),
                "waktuSelesai": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=0.96
                ),
                "sks": FieldValidationInfo(
                    status=FieldValidationLevel.VALID, confidenceScore=1.00
                ),
            },
            provenance=ProvenanceInfo(
                rawTextSnippet="Rabu 13:00 15:30 Lab. Data Science IF253419 R.02 Kecerdasan Buatan 3",
                pageIndex=1,
                extractionMethod="ml_inferred",
            ),
        ),
    ]

    return CanonicalAcademicExtractionResult(
        documentType=AcademicDocumentType.CLASS_SCHEDULE,
        items=dummy_items,
        totalItems=len(dummy_items),
        needsReviewCount=0,
        insufficientForPersistence=False,
        reviewReasons=[],
        metrics=ExtractionMetrics(
            durationMs=elapsed_ms,
            extractedCharacterCount=file_size_bytes,
            sourceFormat=source_format,
        ),
    )


@router.post(
    "/api/extract/academic",
    response_model=CanonicalAcademicExtractionResult,
    summary="Extract Academic Timetable from Document (Multipart)",
    dependencies=[Depends(verify_service_auth)],
)
async def extract_academic_document(
    file: UploadFile = File(..., description="Academic PDF or image file (PNG, JPG, WebP)"),
    preExtractedText: Optional[str] = Form(
        default=None, description="Optional text pre-extracted by client OCR"
    ),
):
    """
    Main extraction endpoint called by TrackerThings Next.js server.
    Protected by service-to-service API key authentication.
    """
    return await _process_academic_extraction(file, preExtractedText)


@router.post(
    "/extract",
    response_model=CanonicalAcademicExtractionResult,
    summary="Legacy Alias Endpoint for SelfHostedServerProvider",
    dependencies=[Depends(verify_service_auth)],
    include_in_schema=False,
)
async def extract_academic_document_alias(
    file: UploadFile = File(...),
    preExtractedText: Optional[str] = Form(default=None),
):
    """Compatibility alias mapping to /api/extract/academic."""
    return await _process_academic_extraction(file, preExtractedText)

