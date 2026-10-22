"""
TrackerThings V2 - Academic Hybrid Extractor (Python Serverless).

Performs deterministic & layout-aware extraction of Indonesian academic timetables,
exam schedules, and course registrations from:
1. Digital PDFs via pdfplumber table and text extraction
2. Pre-extracted text streams / OCR forwarded payloads
3. Scanned PDFs and image files validated via Pillow with zero-disk in-memory processing
"""
import io
import logging
import re
import time
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from PIL import Image
import pdfplumber

# Silence noisy FontBBox warnings from pdfminer when parsing non-standard PDF fonts
logging.getLogger("pdfminer").setLevel(logging.ERROR)

from api.schemas import (
    AcademicDocumentType,
    AcademicRecurrenceType,
    CanonicalAcademicExtractionResult,
    CanonicalAcademicItem,
    ExtractionMetrics,
    FieldValidationInfo,
    FieldValidationLevel,
    ProvenanceInfo,
)

# Canonical Indonesian Day Mapping
HARI_CANONICAL: Dict[str, str] = {
    "senin": "Senin",
    "sen1n": "Senin",
    "senln": "Senin",
    "snn": "Senin",
    "mon": "Senin",
    "monday": "Senin",
    "selasa": "Selasa",
    "se1asa": "Selasa",
    "selas4": "Selasa",
    "sls": "Selasa",
    "tue": "Selasa",
    "tuesday": "Selasa",
    "rabu": "Rabu",
    "r4bu": "Rabu",
    "wed": "Rabu",
    "wednesday": "Rabu",
    "kamis": "Kamis",
    "kam1s": "Kamis",
    "k4mis": "Kamis",
    "kms": "Kamis",
    "thu": "Kamis",
    "thursday": "Kamis",
    "jumat": "Jumat",
    "jum'at": "Jumat",
    "jumaat": "Jumat",
    "jum4t": "Jumat",
    "jmt": "Jumat",
    "fri": "Jumat",
    "friday": "Jumat",
    "sabtu": "Sabtu",
    "s4btu": "Sabtu",
    "sat": "Sabtu",
    "saturday": "Sabtu",
    "minggu": "Minggu",
    "m1nggu": "Minggu",
    "sun": "Minggu",
    "sunday": "Minggu",
}

VALID_DAYS = set(["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"])

INDO_MONTHS: Dict[str, int] = {
    "januari": 1, "jan": 1,
    "februari": 2, "feb": 2,
    "maret": 3, "mar": 3,
    "april": 4, "apr": 4,
    "mei": 5, "may": 5,
    "juni": 6, "jun": 6,
    "juli": 7, "jul": 7,
    "agustus": 8, "agu": 8, "ags": 8,
    "september": 9, "sep": 9,
    "oktober": 10, "okt": 10, "oct": 10,
    "november": 11, "nov": 11,
    "desember": 12, "des": 12, "dec": 12,
}


def validate_file_signature(contents: bytes, content_type: str, filename: str) -> None:
    """
    Validates file magic bytes against content-type to prevent malformed or spoofed uploads.
    """
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded document is empty (0 bytes).",
        )

    ct = content_type.lower()
    fn = filename.lower()

    if "pdf" in ct or fn.endswith(".pdf"):
        if not contents.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid PDF header signature.",
            )
    elif "png" in ct or fn.endswith(".png"):
        if not contents.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid PNG header signature.",
            )
    elif "jpeg" in ct or "jpg" in ct or fn.endswith(".jpg") or fn.endswith(".jpeg"):
        if not contents.startswith(b"\xff\xd8\xff"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid JPEG header signature.",
            )
    elif "webp" in ct or fn.endswith(".webp"):
        if not (contents.startswith(b"RIFF") and len(contents) >= 12 and contents[8:12] == b"WEBP"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or invalid WebP header signature.",
            )


def inspect_image_buffer(contents: bytes) -> Tuple[str, int, int]:
    """
    Validates an image buffer using Pillow and checks safety limits.
    Returns (format_metadata, width, height).
    """
    try:
        with Image.open(io.BytesIO(contents)) as img:
            img.verify()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or invalid image data: {str(e)}",
        )

    # Re-open after verify() to inspect metadata
    with Image.open(io.BytesIO(contents)) as img:
        width, height = img.size
        # Limit dimensions to prevent decompression bombs (e.g. 10000x10000)
        if width <= 0 or height <= 0 or width > 10000 or height > 10000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image dimensions: {width}x{height} (max 10000x10000).",
            )
        metadata = f"Pillow: {img.format} {width}x{height} ({img.mode})"
        return metadata, width, height


def normalize_indonesian_day(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    clean = re.sub(r"[^a-z0-9']", "", raw.strip().lower())
    return HARI_CANONICAL.get(clean)


def normalize_time_string(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    match = re.search(r"(\d{1,2})[:.](\d{2})", raw.strip())
    if not match:
        return None
    h = int(match.group(1))
    m = int(match.group(2))
    if h < 0 or h > 23 or m < 0 or m > 59:
        return None
    return f"{h:02d}:{m:02d}"


def normalize_course_code(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    clean = re.sub(r"\s+", "", raw.strip().upper())
    # Correct common OCR substitutions (e.g. 1F -> IF, 1T -> IT)
    clean = re.sub(r"^1F", "IF", clean)
    clean = re.sub(r"^1T", "IT", clean)
    if re.match(r"^[A-Z]{2,4}[-\s]?\d{3,6}$", clean):
        return clean
    return None


def parse_date_from_text(text: str) -> Optional[str]:
    # Match ISO YYYY-MM-DD
    iso_match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if iso_match:
        return f"{iso_match.group(1)}-{iso_match.group(2)}-{iso_match.group(3)}"

    # Match Indonesian text date: 26 Oktober 2026
    indo_match = re.search(r"\b(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\b", text)
    if indo_match:
        day = int(indo_match.group(1))
        m_str = indo_match.group(2).lower()
        year = int(indo_match.group(3))
        month = INDO_MONTHS.get(m_str)
        if month and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"

    # Match DD/MM/YYYY or DD-MM-YYYY
    slash_match = re.search(r"\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})\b", text)
    if slash_match:
        d = int(slash_match.group(1))
        m = int(slash_match.group(2))
        y = int(slash_match.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"

    return None


def detect_document_category(text: str) -> AcademicDocumentType:
    lower = text.lower()
    exam_keywords = ["jadwal ujian", "uts", "uas", "ujian tengah semester", "ujian akhir semester", "pengawas"]
    exam_matches = sum(1 for k in exam_keywords if k in lower)
    if exam_matches >= 2 or ("ujian" in lower and any(k in lower for k in ["ruang ujian", "sifat ujian"])):
        return AcademicDocumentType.EXAM_SCHEDULE

    if any(k in lower for k in ["kelas pengganti", "kuliah pengganti", "reschedule"]):
        return AcademicDocumentType.REPLACEMENT_CLASS

    if ("kartu rencana studi" in lower or "krs" in lower or "daftar mata kuliah" in lower) and not any(
        k in lower for k in ["waktu", "mulai", "jam"]
    ):
        return AcademicDocumentType.COURSE_REGISTRATION_KRS

    if any(k in lower for k in ["jadwal", "siakad", "kuliah", "senin", "selasa", "rabu", "kamis", "jumat"]):
        return AcademicDocumentType.CLASS_SCHEDULE

    return AcademicDocumentType.UNKNOWN


def map_header_columns(header_cells: List[str]) -> Dict[str, int]:
    """
    Identifies column semantic roles from header row cell labels.
    """
    col_map: Dict[str, int] = {}
    for idx, raw_cell in enumerate(header_cells):
        if not raw_cell:
            continue
        c = raw_cell.strip().lower()
        if re.search(r"\b(hari|day)\b", c) and "hari" not in col_map:
            col_map["hari"] = idx
        elif re.search(r"\b(tanggal|tgl|date)\b", c) and "tanggal" not in col_map:
            col_map["tanggal"] = idx
        elif re.search(r"\b(mulai|start)\b", c) and "mulai" not in col_map:
            col_map["mulai"] = idx
        elif re.search(r"\b(selesai|akhir|end)\b", c) and "selesai" not in col_map:
            col_map["selesai"] = idx
        elif re.search(r"\b(waktu|jam|sesi|time)\b", c) and "waktu" not in col_map and "mulai" not in col_map:
            col_map["waktu"] = idx
        elif re.search(r"\b(mata\s*kuliah|matakuliah|nama\s*mk|course|subject)\b", c) and re.search(r"\b(kode|code)\b", c):
            col_map["nama"] = idx
            col_map["compound_kode"] = idx
        elif re.search(r"\b(mata\s*kuliah|matakuliah|nama\s*mk|course|subject)\b", c) and "nama" not in col_map:
            col_map["nama"] = idx
        elif re.search(r"\b(kode|code)\b", c) and "kode" not in col_map:
            col_map["kode"] = idx
        elif re.search(r"\b(ruang|ruangan|lokasi|room|studio)\b", c) and "lokasi" not in col_map:
            col_map["lokasi"] = idx
        elif re.search(r"\b(kls|kelas|class|section)\b", c) and "kelas" not in col_map:
            col_map["kelas"] = idx
        elif re.search(r"\b(dosen|pengajar|lecturer|instructor)\b", c) and "dosen" not in col_map:
            col_map["dosen"] = idx
        elif re.search(r"\b(sks|credit|credits)\b", c) and "sks" not in col_map:
            col_map["sks"] = idx
    return col_map


def build_validated_item(
    row_id: str,
    nama_matkul: str,
    kode_matkul: Optional[str] = None,
    kelas: Optional[str] = None,
    hari: Optional[str] = None,
    tanggal: Optional[str] = None,
    waktu_mulai: Optional[str] = None,
    waktu_selesai: Optional[str] = None,
    lokasi: Optional[str] = None,
    dosen: Optional[str] = None,
    sks: Optional[int] = None,
    kategori: str = "Wajib",
    doc_type: AcademicDocumentType = AcademicDocumentType.CLASS_SCHEDULE,
    raw_snippet: Optional[str] = None,
    page_idx: Optional[int] = 1,
    method: str = "text_stream",
) -> Optional[CanonicalAcademicItem]:
    clean_nama = re.sub(r"\s+", " ", nama_matkul or "").strip()
    if not clean_nama or len(clean_nama) < 2:
        return None

    # Normalizations
    norm_day = normalize_indonesian_day(hari)
    norm_start = normalize_time_string(waktu_mulai)
    norm_end = normalize_time_string(waktu_selesai)
    norm_code = normalize_course_code(kode_matkul) if kode_matkul else None
    norm_date = parse_date_from_text(tanggal) if tanggal else None

    # Recurrence classification
    is_exam = doc_type == AcademicDocumentType.EXAM_SCHEDULE or bool(norm_date)
    is_replacement = doc_type == AcademicDocumentType.REPLACEMENT_CLASS
    if is_exam or is_replacement or norm_date:
        recurrence = AcademicRecurrenceType.ONE_TIME
    elif norm_day:
        recurrence = AcademicRecurrenceType.WEEKLY
    else:
        recurrence = AcademicRecurrenceType.NONE

    # Build field validations
    field_validations: Dict[str, FieldValidationInfo] = {
        "namaMatkul": FieldValidationInfo(
            status=FieldValidationLevel.VALID if len(clean_nama) >= 2 else FieldValidationLevel.INVALID,
            confidenceScore=0.98 if len(clean_nama) >= 3 else 0.70,
        )
    }

    warnings: List[str] = []
    has_time_error = False

    if norm_start and norm_end:
        if norm_start >= norm_end:
            has_time_error = True
            warnings.append(f"Waktu mulai ({norm_start}) tidak boleh lebih lambat dari waktu selesai ({norm_end})")
            field_validations["waktuMulai"] = FieldValidationInfo(
                status=FieldValidationLevel.INVALID,
                confidenceScore=0.4,
                message="Waktu terbalik",
            )
            field_validations["waktuSelesai"] = FieldValidationInfo(
                status=FieldValidationLevel.INVALID,
                confidenceScore=0.4,
                message="Waktu terbalik",
            )
        else:
            field_validations["waktuMulai"] = FieldValidationInfo(
                status=FieldValidationLevel.VALID, confidenceScore=0.97
            )
            field_validations["waktuSelesai"] = FieldValidationInfo(
                status=FieldValidationLevel.VALID, confidenceScore=0.97
            )
    else:
        if recurrence == AcademicRecurrenceType.WEEKLY:
            if not norm_start:
                field_validations["waktuMulai"] = FieldValidationInfo(
                    status=FieldValidationLevel.MISSING, confidenceScore=0.0
                )
                warnings.append("Waktu mulai tidak terdeteksi")
            if not norm_end:
                field_validations["waktuSelesai"] = FieldValidationInfo(
                    status=FieldValidationLevel.MISSING, confidenceScore=0.0
                )
                warnings.append("Waktu selesai tidak terdeteksi")

    if norm_day:
        field_validations["hari"] = FieldValidationInfo(
            status=FieldValidationLevel.VALID, confidenceScore=0.99
        )
    elif recurrence == AcademicRecurrenceType.WEEKLY:
        field_validations["hari"] = FieldValidationInfo(
            status=FieldValidationLevel.MISSING, confidenceScore=0.0
        )
        warnings.append("Hari tidak terdeteksi")

    if sks is not None:
        if 1 <= sks <= 8:
            field_validations["sks"] = FieldValidationInfo(
                status=FieldValidationLevel.VALID, confidenceScore=1.00
            )
        else:
            field_validations["sks"] = FieldValidationInfo(
                status=FieldValidationLevel.INVALID, confidenceScore=0.3, message="SKS di luar batas (1-8)"
            )
            warnings.append(f"Nilai SKS {sks} tidak wajar")

    needs_review = (
        has_time_error
        or len(warnings) > 0
        or (recurrence == AcademicRecurrenceType.WEEKLY and (not norm_day or not norm_start))
        or (recurrence == AcademicRecurrenceType.ONE_TIME and (not norm_date or not norm_start))
    )

    return CanonicalAcademicItem(
        id=row_id,
        namaMatkul=clean_nama,
        kodeMatkul=norm_code,
        kelas=kelas.strip() if kelas else None,
        hari=norm_day,
        tanggal=norm_date,
        waktuMulai=norm_start,
        waktuSelesai=norm_end,
        lokasi=lokasi.strip() if lokasi else None,
        dosen=dosen.strip() if dosen else None,
        sks=sks,
        kategori=kategori,
        recurrence=recurrence,
        needsReview=needs_review,
        warnings=warnings,
        fieldValidations=field_validations,
        provenance=ProvenanceInfo(
            rawTextSnippet=raw_snippet or clean_nama,
            pageIndex=page_idx,
            extractionMethod=method,
        ),
    )


def parse_cells_with_map(
    cells: List[str],
    col_map: Dict[str, int],
    row_idx: int,
    doc_type: AcademicDocumentType,
    page_idx: int = 1,
    method: str = "text_stream",
) -> Optional[CanonicalAcademicItem]:
    def get_col(name: str) -> Optional[str]:
        idx = col_map.get(name)
        if idx is not None and idx < len(cells) and cells[idx]:
            val = re.sub(r"\s+", " ", cells[idx].strip())
            return val if val else None
        return None

    nama_val = get_col("nama")
    if not nama_val:
        return None

    hari_val = get_col("hari")
    tanggal_val = get_col("tanggal")
    kode_val = get_col("kode")
    kelas_val = get_col("kelas")
    lokasi_val = get_col("lokasi")
    dosen_val = get_col("dosen")
    mulai_val = get_col("mulai")
    selesai_val = get_col("selesai")
    waktu_val = get_col("waktu")

    # If separate mulai & selesai are absent but combined waktu is present
    if (not mulai_val or not selesai_val) and waktu_val:
        time_match = re.search(
            r"(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s/d|sd|sampai|to)\s*(\d{1,2}[:.]\d{2})",
            waktu_val,
            re.IGNORECASE,
        )
        if time_match:
            mulai_val = time_match.group(1)
            selesai_val = time_match.group(2)
        else:
            single_match = re.search(r"(\d{1,2}[:.]\d{2})", waktu_val)
            if single_match and not mulai_val:
                mulai_val = single_match.group(1)

    # Clean noise from times (e.g. "08:00 - 13:00 (5 Jam Penuh)")
    if mulai_val:
        mulai_val = re.sub(r"\(.*?\)", "", mulai_val).strip()
    if selesai_val:
        selesai_val = re.sub(r"\(.*?\)", "", selesai_val).strip()

    # If code is absent or compound column detected, extract embedded course code from nama_val
    if (not kode_val or "compound_kode" in col_map) and nama_val:
        code_match = re.search(r"\b([A-Z]{2,4}[-\s]?\d{3,6})\b", nama_val)
        if code_match:
            if not kode_val:
                kode_val = code_match.group(1)
            nama_val = nama_val.replace(code_match.group(0), "")

    # Clean annotations from course title
    if nama_val:
        nama_val = re.sub(r"\((?:Mata\s*Kuliah\s*Inti|Mata\s*Kuliah\s*Pilihan|Wajib|Pilihan|[0-9]+\s*Jam[^\)]*)\)", "", nama_val, flags=re.IGNORECASE)
        nama_val = re.sub(r"\s+", " ", nama_val).strip()

    sks_val: Optional[int] = None
    raw_sks = get_col("sks")
    if raw_sks and re.match(r"^\d+$", raw_sks):
        sks_val = int(raw_sks)

    row_id = f"row_{page_idx}_{row_idx}"
    raw_line = " | ".join(c.strip() for c in cells if c and c.strip())

    return build_validated_item(
        row_id=row_id,
        nama_matkul=nama_val,
        kode_matkul=kode_val,
        kelas=kelas_val,
        hari=hari_val,
        tanggal=tanggal_val,
        waktu_mulai=mulai_val,
        waktu_selesai=selesai_val,
        lokasi=lokasi_val,
        dosen=dosen_val,
        sks=sks_val,
        doc_type=doc_type,
        raw_snippet=raw_line,
        page_idx=page_idx,
        method=method,
    )


def parse_unmapped_row(
    cells: List[str],
    row_idx: int,
    doc_type: AcademicDocumentType,
    page_idx: int = 1,
    method: str = "text_stream",
) -> Optional[CanonicalAcademicItem]:
    clean_cells = [c.strip() for c in cells if c and c.strip()]
    if len(clean_cells) < 2:
        return None

    # Skip header row if it contains keywords, but never skip rows containing time ranges
    has_time = any(re.search(r"\d{1,2}[:.]\d{2}", c) for c in clean_cells)
    if not has_time and row_idx <= 2:
        first_two = " ".join(clean_cells[:3]).lower()
        if any(k in first_two for k in ["mata kuliah", "matakuliah", "kode mk", "ruang", "waktu", "sks"]):
            return None

    hari: Optional[str] = None
    tanggal: Optional[str] = None
    waktu_mulai: Optional[str] = None
    waktu_selesai: Optional[str] = None
    kode_matkul: Optional[str] = None
    nama_matkul: Optional[str] = None
    kelas: Optional[str] = None
    lokasi: Optional[str] = None
    sks: Optional[int] = None
    dosen: Optional[str] = None

    cell_idx = 0
    for cell in clean_cells:
        # Skip leading sequence number column (e.g. "1", "2")
        if cell_idx == 0 and re.match(r"^\d+$", cell) and len(clean_cells) >= 4:
            cell_idx += 1
            continue
        cell_idx += 1

        # 1. Day check
        d = normalize_indonesian_day(cell)
        if d and not hari:
            hari = d
            continue

        # 2. Date check
        parsed_d = parse_date_from_text(cell)
        if parsed_d and not tanggal:
            tanggal = parsed_d
            continue

        # 3. Time range check (08:00 - 10:30, 08.00-10.30, Sesi 1-2 (08:00 - 09:40))
        t_range = re.search(
            r"(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s/d|sd|sampai|to)\s*(\d{1,2}[:.]\d{2})",
            cell,
            re.IGNORECASE,
        )
        if t_range:
            waktu_mulai = normalize_time_string(t_range.group(1))
            waktu_selesai = normalize_time_string(t_range.group(2))
            continue

        single_t = re.match(r"^(\d{1,2}[:.]\d{2})$", cell)
        if single_t:
            t = normalize_time_string(single_t.group(1))
            if not waktu_mulai:
                waktu_mulai = t
            elif not waktu_selesai:
                waktu_selesai = t
            continue

        # 4. Course code (IF253418, CS101, TIF-301)
        code = normalize_course_code(cell)
        if code and not kode_matkul:
            kode_matkul = code
            continue

        # 5. Class / Section (R.01, Kls A, 01, A)
        if re.match(r"^(?:R\.?\d{2}|[A-Z]|\d{2})$", cell, re.IGNORECASE) and not kelas and len(cell) <= 4:
            kelas = cell.upper()
            continue

        # 6. SKS (integer 1-8)
        if re.match(r"^[1-8]$", cell) and sks is None:
            sks = int(cell)
            continue

        # 7. Room / Lokasi
        if re.search(r"\b(?:Lab|Ruang|R\.|Studio|Gedung|D\.\d+|L\.\d+|Online|Zoom|Auditorium)\b", cell, re.IGNORECASE) and not lokasi:
            lokasi = cell
            continue

        # 8. Lecturer (contains Gelar: Dr, M.Kom, S.T, Prof, Ar., M.Arch, M.Pd, etc.)
        if re.search(r"\b(?:Dr|Prof|M\.Kom|S\.T|M\.T|S\.Kom|Ph\.D|Ir\.|Ar\.|M\.Arch|M\.Pd|M\.Ds|M\.Sc)\b", cell, re.IGNORECASE) and not dosen:
            dosen = cell
            continue

        # 9. Course Name candidate
        if len(cell) >= 3 and not re.match(r"^\d+$", cell):
            if not nama_matkul:
                nama_matkul = cell
            elif len(cell) > len(nama_matkul) and not lokasi:
                lokasi = nama_matkul
                nama_matkul = cell

    if not nama_matkul:
        return None

    # If code is absent, extract embedded course code from nama_matkul
    if not kode_matkul and nama_matkul:
        code_match = re.search(r"\b([A-Z]{2,4}[-\s]?\d{3,6})\b", nama_matkul)
        if code_match:
            kode_matkul = code_match.group(1)
            nama_matkul = nama_matkul.replace(code_match.group(0), "")

    # Clean annotations from course title
    if nama_matkul:
        nama_matkul = re.sub(r"\((?:Mata\s*Kuliah\s*Inti|Mata\s*Kuliah\s*Pilihan|Wajib|Pilihan|[0-9]+\s*Jam[^\)]*)\)", "", nama_matkul, flags=re.IGNORECASE)
        nama_matkul = re.sub(r"\s+", " ", nama_matkul).strip()

    row_id = f"row_{page_idx}_{row_idx}"
    raw_line = " | ".join(clean_cells)
    return build_validated_item(
        row_id=row_id,
        nama_matkul=nama_matkul,
        kode_matkul=kode_matkul,
        kelas=kelas,
        hari=hari,
        tanggal=tanggal,
        waktu_mulai=waktu_mulai,
        waktu_selesai=waktu_selesai,
        lokasi=lokasi,
        dosen=dosen,
        sks=sks,
        doc_type=doc_type,
        raw_snippet=raw_line,
        page_idx=page_idx,
        method=method,
    )


def parse_freeform_line(
    line: str,
    row_idx: int,
    doc_type: AcademicDocumentType,
    page_idx: int = 1,
    method: str = "text_stream",
) -> Optional[CanonicalAcademicItem]:
    """
    Parses a non-delimited line by identifying and stripping day, time, code, and SKS tokens,
    leaving the full multi-word course name intact.
    """
    tokens = line.split()
    if len(tokens) < 3:
        return None

    hari: Optional[str] = None
    kode_matkul: Optional[str] = None
    waktu_mulai: Optional[str] = None
    waktu_selesai: Optional[str] = None
    sks: Optional[int] = None

    for tok in tokens:
        d = normalize_indonesian_day(tok)
        if d and not hari:
            hari = d
        code = normalize_course_code(tok)
        if code and not kode_matkul:
            kode_matkul = code

    time_match = re.search(
        r"(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s/d|sd|sampai|to)\s*(\d{1,2}[:.]\d{2})",
        line,
        re.IGNORECASE,
    )
    if time_match:
        waktu_mulai = normalize_time_string(time_match.group(1))
        waktu_selesai = normalize_time_string(time_match.group(2))

    # SKS detection: trailing "3 SKS", "3sks", or "3"
    sks_match = re.search(r"\b([1-8])\s*sks\b", line, re.IGNORECASE)
    if sks_match:
        sks = int(sks_match.group(1))
    elif re.match(r"^[1-8]$", tokens[-1]):
        sks = int(tokens[-1])

    parsed_date = parse_date_from_text(line)

    if not hari and not parsed_date and not waktu_mulai and not (kode_matkul or sks):
        return None

    cleaned = line
    if hari:
        cleaned = re.sub(rf"\b{re.escape(hari)}\b", "", cleaned, flags=re.IGNORECASE)
    if kode_matkul:
        cleaned = re.sub(rf"\b{re.escape(kode_matkul)}\b", "", cleaned, flags=re.IGNORECASE)
    if time_match:
        cleaned = cleaned.replace(time_match.group(0), "")
    if sks:
        cleaned = re.sub(rf"\b{sks}\s*sks\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(rf"\b{sks}\b\s*$", "", cleaned)
    cleaned = re.sub(r"\bsks\b", "", cleaned, flags=re.IGNORECASE)

    nama_matkul = re.sub(r"[^a-zA-Z0-9\s()\-]", " ", cleaned)
    nama_matkul = re.sub(r"\s+", " ", nama_matkul).strip()
    if not nama_matkul or len(nama_matkul) < 2:
        return None

    row_id = f"free_{page_idx}_{row_idx}"
    return build_validated_item(
        row_id=row_id,
        nama_matkul=nama_matkul,
        kode_matkul=kode_matkul,
        hari=hari,
        tanggal=parsed_date,
        waktu_mulai=waktu_mulai,
        waktu_selesai=waktu_selesai,
        sks=sks,
        doc_type=doc_type,
        raw_snippet=line,
        page_idx=page_idx,
        method=method,
    )


def extract_from_delimited_text(
    text: str,
    method: str = "text_stream",
) -> CanonicalAcademicExtractionResult:
    """
    Extracts canonical academic items from structured delimited or newline text.
    """
    start_time = time.perf_counter()
    doc_type = detect_document_category(text)
    lines = [
        l.strip()
        for l in text.splitlines()
        if l.strip() and not re.match(r"^--\s*\d+\s+of\s+\d+\s*--$", l.strip(), re.IGNORECASE)
    ]

    items: List[CanonicalAcademicItem] = []
    active_col_map: Optional[Dict[str, int]] = None
    line_idx = 0

    for line in lines:
        line_idx += 1
        # Check if line is title/document metadata
        if re.match(r"^(jadwal|kartu rencana|fakultas|universitas|daftar|pemberitahuan|semester)", line, re.IGNORECASE) and "|" not in line and "\t" not in line:
            continue

        delimiter = "|" if "|" in line else "\t" if "\t" in line else None
        if delimiter:
            cells = [c.strip() for c in line.split(delimiter) if c.strip()]
            # Check for header
            header_map = map_header_columns(cells)
            if len(header_map) >= 2:
                active_col_map = header_map
                continue

            parsed_item: Optional[CanonicalAcademicItem] = None
            if active_col_map and "nama" in active_col_map:
                parsed_item = parse_cells_with_map(cells, active_col_map, line_idx, doc_type, method=method)

            if not parsed_item:
                parsed_item = parse_unmapped_row(cells, line_idx, doc_type, method=method)

            if parsed_item:
                items.append(parsed_item)
        else:
            # Freeform line parsing
            parsed_item = parse_freeform_line(line, line_idx, doc_type, method=method)
            if parsed_item:
                items.append(parsed_item)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    needs_review_count = sum(1 for i in items if i.needsReview)
    insufficient = len(items) == 0

    review_reasons: List[str] = []
    if insufficient:
        review_reasons.append("Tidak ada jadwal yang terdeteksi dari teks dokumen.")
    elif needs_review_count > 0:
        review_reasons.append(f"{needs_review_count} baris memerlukan peninjauan kolom waktu atau hari.")

    return CanonicalAcademicExtractionResult(
        documentType=doc_type,
        items=items,
        totalItems=len(items),
        needsReviewCount=needs_review_count,
        insufficientForPersistence=insufficient,
        reviewReasons=review_reasons,
        metrics=ExtractionMetrics(
            durationMs=elapsed_ms,
            extractedCharacterCount=len(text),
            sourceFormat=method,
        ),
    )


def extract_from_digital_pdf(
    pdf_bytes: bytes,
) -> CanonicalAcademicExtractionResult:
    """
    Extracts academic timetable items from digital PDF bytes using pdfplumber.
    Inspects tables first, falls back to text layout parsing, and safely flags scanned PDFs.
    """
    start_time = time.perf_counter()
    all_items: List[CanonicalAcademicItem] = []
    accumulated_text = ""
    is_scanned = True

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            num_pages = len(pdf.pages)
            for page_idx, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                accumulated_text += "\n" + page_text
                if len(page_text.strip()) > 10:
                    is_scanned = False

                # 1. Table extraction
                tables = page.extract_tables() or []
                page_extracted_items: List[CanonicalAcademicItem] = []

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    # Header detection
                    header_row = [str(c or "").strip() for c in table[0]]
                    col_map = map_header_columns(header_row)

                    start_row = 1 if len(col_map) >= 2 else 0
                    last_valid_day: Optional[str] = None

                    for row_idx, row in enumerate(table[start_row:], start=start_row + 1):
                        cell_strings = [str(c or "").strip() for c in row]

                        # Merged day propagation
                        if col_map and "hari" in col_map:
                            day_idx = col_map["hari"]
                            if day_idx < len(cell_strings) and cell_strings[day_idx]:
                                norm_d = normalize_indonesian_day(cell_strings[day_idx])
                                if norm_d:
                                    last_valid_day = norm_d
                            elif last_valid_day and day_idx < len(cell_strings):
                                cell_strings[day_idx] = last_valid_day

                        item: Optional[CanonicalAcademicItem] = None
                        if col_map and "nama" in col_map:
                            item = parse_cells_with_map(
                                cell_strings,
                                col_map,
                                row_idx,
                                AcademicDocumentType.CLASS_SCHEDULE,
                                page_idx=page_idx,
                                method="text_stream",
                            )
                        if not item:
                            item = parse_unmapped_row(
                                cell_strings,
                                row_idx,
                                AcademicDocumentType.CLASS_SCHEDULE,
                                page_idx=page_idx,
                                method="text_stream",
                            )
                        if item:
                            # Propagate last valid day if item still lacks day
                            if not item.hari and last_valid_day and item.recurrence == AcademicRecurrenceType.WEEKLY:
                                item.hari = last_valid_day
                            page_extracted_items.append(item)

                if page_extracted_items:
                    all_items.extend(page_extracted_items)
                elif page_text.strip():
                    # Fallback to text line extraction for this page
                    text_result = extract_from_delimited_text(page_text, method="text_stream")
                    all_items.extend(text_result.items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or unreadable PDF document: {str(e)}",
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    doc_type = detect_document_category(accumulated_text)

    # Scanned PDF detection
    if is_scanned and len(all_items) == 0:
        return CanonicalAcademicExtractionResult(
            documentType=AcademicDocumentType.UNKNOWN,
            items=[],
            totalItems=0,
            needsReviewCount=0,
            insufficientForPersistence=True,
            reviewReasons=[
                "Dokumen PDF pindaian (scanned) tanpa lapisan teks digital terdeteksi. Silakan gunakan pemrosesan OCR atau Vision AI."
            ],
            metrics=ExtractionMetrics(
                durationMs=elapsed_ms,
                extractedCharacterCount=len(accumulated_text.strip()),
                sourceFormat="scanned_pdf",
            ),
        )

    needs_review_count = sum(1 for i in all_items if i.needsReview)
    insufficient = len(all_items) == 0

    review_reasons: List[str] = []
    if insufficient:
        review_reasons.append("Tidak ada jadwal akademik yang terdeteksi dari tabel PDF.")
    elif needs_review_count > 0:
        review_reasons.append(f"{needs_review_count} baris memiliki kolom yang memerlukan verifikasi manual.")

    return CanonicalAcademicExtractionResult(
        documentType=doc_type,
        items=all_items,
        totalItems=len(all_items),
        needsReviewCount=needs_review_count,
        insufficientForPersistence=insufficient,
        reviewReasons=review_reasons,
        metrics=ExtractionMetrics(
            durationMs=elapsed_ms,
            extractedCharacterCount=len(accumulated_text.strip()),
            sourceFormat="pdf_text",
        ),
    )


def extract_academic_document(
    contents: bytes,
    filename: str,
    content_type: str,
    pre_extracted_text: Optional[str] = None,
) -> CanonicalAcademicExtractionResult:
    """
    Main entry point for academic extraction.
    Validates magic bytes, manages in-memory buffers with zero disk writes,
    and runs the appropriate parser tier.
    """
    start_time = time.perf_counter()

    # 1. Magic bytes & header validation
    validate_file_signature(contents, content_type, filename)

    ct = content_type.lower()
    fn = filename.lower()

    # 2. Digital PDF path
    if "pdf" in ct or fn.endswith(".pdf"):
        return extract_from_digital_pdf(contents)

    # 3. Image path
    if ct.startswith("image/") or any(fn.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]):
        img_meta, width, height = inspect_image_buffer(contents)

        # If client or upstream OCR provided preExtractedText, parse it
        if pre_extracted_text and len(pre_extracted_text.strip()) > 10:
            result = extract_from_delimited_text(pre_extracted_text, method="ocr_text")
            result.metrics.sourceFormat = f"image_ocr ({img_meta})"
            return result

        # Without OCR text, image cannot be deterministically parsed locally without heavy models
        # Accurately signal insufficientForPersistence to trigger user-consented Vision AI fallback
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return CanonicalAcademicExtractionResult(
            documentType=AcademicDocumentType.CLASS_SCHEDULE,
            items=[],
            totalItems=0,
            needsReviewCount=0,
            insufficientForPersistence=True,
            reviewReasons=[
                f"Dokumen gambar ({img_meta}) memerlukan OCR atau Vision AI untuk mengekstrak teks jadwal."
            ],
            metrics=ExtractionMetrics(
                durationMs=elapsed_ms,
                extractedCharacterCount=len(contents),
                sourceFormat=f"image ({img_meta})",
            ),
        )

    # 4. Fallback if content was pure text or unspecified
    text_content = contents.decode("utf-8", errors="replace")
    return extract_from_delimited_text(text_content, method="text_stream")


if __name__ == "__main__":
    import argparse
    import os
    import sys
    import json
    import logging
    import warnings

    warnings.filterwarnings("ignore")
    logging.getLogger("pdfminer").setLevel(logging.ERROR)
    logging.getLogger("pdfplumber").setLevel(logging.ERROR)

    parser = argparse.ArgumentParser(description="Extract academic items from document")
    parser.add_argument("file_path", help="Path to PDF or document file")
    parser.add_argument("--mime", default="application/pdf", help="File MIME type")
    args = parser.parse_args()

    with open(args.file_path, "rb") as f:
        file_bytes = f.read()

    result = extract_academic_document(file_bytes, os.path.basename(args.file_path), args.mime)
    sys.stdout.write(result.model_dump_json() + "\n")
    sys.stdout.flush()
