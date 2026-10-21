"""Pydantic schemas matching TrackerThings V2 Canonical Academic Contracts."""
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class AcademicDocumentType(str, Enum):
    CLASS_SCHEDULE = "class_schedule"
    EXAM_SCHEDULE = "exam_schedule"
    COURSE_REGISTRATION_KRS = "course_registration_krs"
    REPLACEMENT_CLASS = "replacement_class"
    UNKNOWN = "unknown"


class AcademicRecurrenceType(str, Enum):
    WEEKLY = "weekly"
    ONE_TIME = "one_time"
    NONE = "none"


class FieldValidationLevel(str, Enum):
    VALID = "valid"
    TENTATIVE = "tentative"
    INVALID = "invalid"
    MISSING = "missing"


class FieldValidationInfo(BaseModel):
    status: FieldValidationLevel
    confidenceScore: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Calibrated score 0.0 - 1.0"
    )
    message: Optional[str] = None


class ProvenanceInfo(BaseModel):
    rawTextSnippet: Optional[str] = None
    pageIndex: Optional[int] = None
    extractionMethod: Optional[str] = "ml_inferred"


class CanonicalAcademicItem(BaseModel):
    id: str = Field(description="Deterministic item identifier for UI tracking")
    namaMatkul: str = Field(description="Official course name")
    kodeMatkul: Optional[str] = None
    kelas: Optional[str] = None
    hari: Optional[str] = None
    tanggal: Optional[str] = None
    waktuMulai: Optional[str] = None
    waktuSelesai: Optional[str] = None
    lokasi: Optional[str] = None
    dosen: Optional[str] = None
    sks: Optional[int] = None
    kategori: Optional[str] = "Wajib"
    recurrence: AcademicRecurrenceType = AcademicRecurrenceType.WEEKLY
    needsReview: bool = False
    warnings: List[str] = Field(default_factory=list)
    fieldValidations: Dict[str, FieldValidationInfo] = Field(default_factory=dict)
    provenance: Optional[ProvenanceInfo] = None


class ExtractionMetrics(BaseModel):
    durationMs: float
    extractedCharacterCount: int
    sourceFormat: str


class CanonicalAcademicExtractionResult(BaseModel):
    documentType: AcademicDocumentType
    items: List[CanonicalAcademicItem]
    totalItems: int
    needsReviewCount: int
    insufficientForPersistence: bool
    reviewReasons: List[str] = Field(default_factory=list)
    metrics: ExtractionMetrics

