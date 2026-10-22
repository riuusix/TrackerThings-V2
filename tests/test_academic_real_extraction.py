"""
TrackerThings V2 â€” Academic Extraction Real-Document Accuracy Benchmark.

Evaluates field-level extraction accuracy against a verified test set:
1. digital_schedule.pdf (Digital PDF with multi-column table stream)
2. scanned_schedule.pdf (Scanned PDF with raster image only, zero text layer)
3. schedule_image.png (Timetable screenshot, with & without OCR stream)

Measures and asserts:
- Field-by-field accuracy: namaMatkul, hari, waktuMulai, waktuSelesai, dosen, lokasi, kodeMatkul, kelas, sks
- Unsupported fields reported as None (zero hallucinated/invented values)
- Proper fallback triggers (insufficientForPersistence=True) for scanned/unassisted image documents
"""
import json
from pathlib import Path
import pytest

from api.extractor import extract_academic_document
from api.schemas import AcademicDocumentType

REPO_ROOT = Path(__file__).resolve().parent.parent
TEST_SET_DIR = REPO_ROOT / "datasets" / "test_set"
GROUND_TRUTH_FILE = TEST_SET_DIR / "ground_truth.json"


@pytest.fixture(scope="module")
def ground_truth():
    assert GROUND_TRUTH_FILE.exists(), f"Ground truth file missing at {GROUND_TRUTH_FILE}"
    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def test_real_extraction_digital_pdf(ground_truth):
    """
    Evaluates real extraction from a digital PDF with layout/tables.
    Measures field-level accuracy across all 10 canonical fields per row.
    """
    pdf_path = TEST_SET_DIR / "digital_schedule.pdf"
    assert pdf_path.exists(), f"File {pdf_path} not found"

    with open(pdf_path, "rb") as f:
        contents = f.read()

    result = extract_academic_document(contents, "digital_schedule.pdf", "application/pdf")
    gt = ground_truth["digital_schedule.pdf"]

    assert result.documentType == AcademicDocumentType.CLASS_SCHEDULE
    assert result.insufficientForPersistence is False
    assert result.totalItems == gt["totalItems"]
    assert len(result.items) == gt["totalItems"]

    fields_to_evaluate = [
        "namaMatkul",
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "lokasi",
        "kodeMatkul",
        "kelas",
        "sks",
        "dosen",
        "recurrence",
    ]

    total_field_checks = 0
    correct_field_checks = 0
    field_breakdown = {f: {"total": 0, "correct": 0} for f in fields_to_evaluate}

    for idx, expected in enumerate(gt["items"]):
        extracted = result.items[idx]
        for field in fields_to_evaluate:
            expected_val = expected.get(field)
            extracted_val = getattr(extracted, field)
            total_field_checks += 1
            field_breakdown[field]["total"] += 1

            if extracted_val == expected_val:
                correct_field_checks += 1
                field_breakdown[field]["correct"] += 1
            else:
                print(f"Mismatch row {idx} field '{field}': expected '{expected_val}', got '{extracted_val}'")

    overall_accuracy = (correct_field_checks / total_field_checks) * 100
    print("\n--- Digital PDF Extraction Accuracy Report ---")
    for f, stats in field_breakdown.items():
        acc = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        print(f"  Field {f:14s}: {stats['correct']}/{stats['total']} ({acc:.1f}%)")
    print(f"Total Digital PDF Accuracy: {correct_field_checks}/{total_field_checks} ({overall_accuracy:.2f}%)\n")

    assert overall_accuracy == 100.0, f"Expected 100% field accuracy on digital PDF, got {overall_accuracy}%"


def test_real_extraction_scanned_pdf(ground_truth):
    """
    Evaluates extraction behavior on a scanned PDF with raster images only and zero selectable text.
    Must NOT invent/hallucinate courses, and must honestly signal insufficientForPersistence=True.
    """
    scanned_path = TEST_SET_DIR / "scanned_schedule.pdf"
    assert scanned_path.exists(), f"File {scanned_path} not found"

    with open(scanned_path, "rb") as f:
        contents = f.read()

    result = extract_academic_document(contents, "scanned_schedule.pdf", "application/pdf")
    gt = ground_truth["scanned_schedule.pdf"]

    assert result.insufficientForPersistence is gt["insufficientForPersistence"]
    assert result.totalItems == gt["totalItems"]
    assert len(result.items) == 0
    assert result.metrics.sourceFormat == "scanned_pdf"
    assert any("pindaian" in r.lower() or "scanned" in r.lower() for r in result.reviewReasons)
    print("\n--- Scanned PDF Extraction Report ---")
    print("  Detected zero selectable text layer (scanned).")
    print(f"  insufficientForPersistence: {result.insufficientForPersistence}")
    print(f"  Total items extracted: {len(result.items)} (zero hallucinations)")
    print(f"  Review reason: {result.reviewReasons[0]}\n")


def test_real_extraction_schedule_image_without_ocr(ground_truth):
    """
    Evaluates image document upload without upstream OCR text.
    Validates Pillow dimension inspection and verifies that insufficientForPersistence=True
    is returned to trigger client Vision AI assist without fabricating false records.
    """
    img_path = TEST_SET_DIR / "schedule_image.png"
    assert img_path.exists(), f"File {img_path} not found"

    with open(img_path, "rb") as f:
        contents = f.read()

    result = extract_academic_document(contents, "schedule_image.png", "image/png")
    gt = ground_truth["schedule_image.png"]["without_ocr"]

    assert result.insufficientForPersistence is gt["insufficientForPersistence"]
    assert result.totalItems == gt["totalItems"]
    assert len(result.items) == 0
    assert "Pillow: PNG 1200x420" in result.metrics.sourceFormat
    assert any("gambar" in r.lower() or "ocr" in r.lower() for r in result.reviewReasons)
    print("\n--- Schedule Image (Raw) Report ---")
    print(f"  Pillow verification: {result.metrics.sourceFormat}")
    print(f"  insufficientForPersistence: {result.insufficientForPersistence}")
    print("  Zero false items invented.\n")


def test_real_extraction_schedule_image_with_ocr_stream(ground_truth):
    """
    Evaluates timetable image extraction when OCR stream is forwarded from browser / upstream.
    Measures field-level extraction accuracy against ground-truth items.
    """
    img_path = TEST_SET_DIR / "schedule_image.png"
    with open(img_path, "rb") as f:
        contents = f.read()

    ocr_stream = (
        "Hari | Mulai | Akhir | Ruang | Kode MK | Kls | Nama MK | SKS\n"
        "Senin | 08:00 | 10:30 | Lab RPL | IF253418 | R.01 | Rekayasa Perangkat Lunak | 3\n"
        "Senin | 10:40 | 13:10 | R.402 | IF253420 | R.01 | Sistem Terdistribusi | 3\n"
        "Selasa | 09:00 | 11:30 | Lab Basis Data | IF253422 | R.02 | Basis Data Lanjut | 3\n"
        "Kamis | 13:00 | 15:30 | R.301 | IF253425 | R.01 | Kecerdasan Buatan | 3\n"
    )

    result = extract_academic_document(
        contents, "schedule_image.png", "image/png", pre_extracted_text=ocr_stream
    )
    gt = ground_truth["schedule_image.png"]["with_ocr"]

    assert result.insufficientForPersistence is False
    assert result.totalItems == gt["totalItems"]
    assert len(result.items) == gt["totalItems"]

    fields_to_evaluate = [
        "namaMatkul",
        "hari",
        "waktuMulai",
        "waktuSelesai",
        "lokasi",
        "kodeMatkul",
        "kelas",
        "sks",
    ]

    total_checks = 0
    correct_checks = 0

    for idx, expected in enumerate(gt["items"]):
        extracted = result.items[idx]
        for field in fields_to_evaluate:
            expected_val = expected.get(field)
            extracted_val = getattr(extracted, field)
            total_checks += 1
            if extracted_val == expected_val:
                correct_checks += 1
            else:
                print(f"Mismatch row {idx} field '{field}': expected '{expected_val}', got '{extracted_val}'")

        # Verify that lecturer (dosen), which was NOT in the table, is correctly reported as None
        # rather than inventing a hallucinated name!
        assert extracted.dosen is None, f"Dosen should be None, got '{extracted.dosen}'"

    accuracy = (correct_checks / total_checks) * 100
    print(f"\n--- Schedule Image with OCR Accuracy: {correct_checks}/{total_checks} ({accuracy:.2f}%) ---")
    assert accuracy == 100.0


def test_real_extraction_unas_fixture():
    """
    Evaluates real UNAS timetable fixture (datasets/fixtures/unas_siakad_sample.txt)
    against verified annotation (datasets/annotations/unas_siakad_sample.json).
    """
    fixture_path = REPO_ROOT / "datasets" / "fixtures" / "unas_siakad_sample.txt"
    annotation_path = REPO_ROOT / "datasets" / "annotations" / "unas_siakad_sample.json"

    with open(fixture_path, "r", encoding="utf-8") as f:
        raw_text = f.read()

    with open(annotation_path, "r", encoding="utf-8") as f:
        annotation = json.load(f)

    result = extract_academic_document(raw_text.encode("utf-8"), "unas_sample.txt", "text/plain")

    assert result.totalItems == len(annotation["items"])
    for idx, expected in enumerate(annotation["items"]):
        extracted = result.items[idx]
        assert extracted.namaMatkul == expected["namaMatkul"]
        assert extracted.hari == expected["hari"]
        assert extracted.waktuMulai == expected["waktuMulai"]
        assert extracted.waktuSelesai == expected["waktuSelesai"]
        assert extracted.kodeMatkul == expected["kodeMatkul"]
        assert extracted.lokasi == expected["lokasi"]
        assert extracted.sks == expected["sks"]


def test_real_extraction_unmapped_table_rows():
    """
    Regression test: ensures parse_unmapped_row does NOT drop items when course title is present
    and cleans annotations without early return None.
    """
    text_sample = (
        "1 | Senin | 08:00 - 10:30 | IF2110 | Pemrograman Lanjut (Mata Kuliah Inti) | R.301 | 3\n"
        "2 | Selasa | 13:00 - 15:30 | IF2120 | Kecerdasan Artifisial | Lab AI | 3"
    )
    result = extract_academic_document(text_sample.encode("utf-8"), "unmapped_sample.txt", "text/plain")

    assert result.totalItems == 2, f"Expected 2 items, got {result.totalItems}"
    assert result.items[0].namaMatkul == "Pemrograman Lanjut", f"Expected cleaned title, got {result.items[0].namaMatkul}"
    assert result.items[0].hari == "Senin"
    assert result.items[0].waktuMulai == "08:00"
    assert result.items[0].waktuSelesai == "10:30"
    assert result.items[1].namaMatkul == "Kecerdasan Artifisial"
    assert result.items[1].hari == "Selasa"

