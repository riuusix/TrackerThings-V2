"""
Generates the 3 test set documents for TrackerThings V2 Academic Extraction Benchmark:
1. digital_schedule.pdf (Digital PDF with text and table layout)
2. scanned_schedule.pdf (Scanned PDF with raster image only, no selectable text)
3. schedule_image.png (Image screenshot of academic timetable)
and their verified ground-truth annotations in ground_truth.json.
"""
import io
import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "datasets" / "test_set"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Digital PDF Generation
def generate_digital_pdf(output_path: Path):
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
    )

    story = [
        Paragraph("JADWAL KULIAH SEMESTER GENAP 2026/2027", title_style),
        Spacer(1, 10),
    ]

    table_data = [
        ["Hari", "Mulai", "Akhir", "Ruang", "Kode MK", "Kls", "Nama MK", "SKS", "Dosen"],
        ["Senin", "08:00", "10:30", "Lab RPL", "IF253418", "R.01", "Rekayasa Perangkat Lunak", "3", "Dr. Budi Santoso"],
        ["Senin", "10:40", "13:10", "R.402", "IF253420", "R.01", "Sistem Terdistribusi", "3", "Prof. Hendra Wijaya"],
        ["Selasa", "09:00", "11:30", "Lab Basis Data", "IF253422", "R.02", "Basis Data Lanjut", "3", "Ir. Siti Rahma M.T"],
        ["Kamis", "13:00", "15:30", "R.301", "IF253425", "R.01", "Kecerdasan Buatan", "3", "Dr. Eng. Hendra"],
    ]

    t = Table(table_data, colWidths=[60, 50, 50, 90, 70, 45, 170, 40, 140])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )

    story.append(t)
    doc.build(story)
    print(f"Generated digital PDF: {output_path}")


# 2. Scanned PDF Generation (image rendered to PDF canvas with zero text layer)
def generate_scanned_pdf(output_path: Path):
    # Create image representation first
    img = Image.new("RGB", (1000, 400), color=(248, 249, 250))
    draw = ImageDraw.Draw(img)

    draw.rectangle([(20, 20), (980, 380)], outline=(180, 180, 180), width=2)
    draw.text((40, 40), "JADWAL KULIAH PINDAIAN (SCANNED DOCUMENT)", fill=(50, 50, 50))
    draw.text((40, 80), "Dokumen ini dipindai dari lembar cetak fisik tanpa lapisan teks OCR.", fill=(100, 100, 100))
    draw.text((40, 120), "Senin | 08:00 - 10:30 | IF253418 | Rekayasa Perangkat Lunak | Lab RPL", fill=(80, 80, 80))

    img_buffer = io.BytesIO()
    img.save(img_buffer, format="JPEG", quality=85)
    img_buffer.seek(0)

    # Save to temporary image or directly into PDF using reportlab Image
    temp_img_path = output_path.with_suffix(".jpg")
    img.save(temp_img_path, format="JPEG", quality=85)

    c = canvas.Canvas(str(output_path), pagesize=landscape(letter))
    # Draw image onto canvas - pure raster graphics, no text operators
    c.drawImage(str(temp_img_path), 50, 150, width=700, height=280)
    c.save()

    if temp_img_path.exists():
        temp_img_path.unlink()

    print(f"Generated scanned PDF (raster only): {output_path}")


# 3. Schedule Image Generation
def generate_schedule_image(output_path: Path):
    img = Image.new("RGB", (1200, 420), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Title header
    draw.rectangle([(0, 0), (1200, 60)], fill=(30, 41, 59))
    draw.text((25, 20), "PORTAL AKADEMIK SIAKAD - JADWAL KULIAH MINGGUAN", fill=(255, 255, 255))

    # Table Header
    headers = ["Hari", "Mulai", "Akhir", "Ruang", "Kode MK", "Kls", "Nama MK", "SKS"]
    col_x = [25, 120, 210, 300, 460, 570, 650, 1100]

    draw.rectangle([(20, 75), (1180, 115)], fill=(226, 232, 240))
    for i, h in enumerate(headers):
        draw.text((col_x[i], 88), h, fill=(15, 23, 42))

    rows = [
        ["Senin", "08:00", "10:30", "Lab RPL", "IF253418", "R.01", "Rekayasa Perangkat Lunak", "3"],
        ["Senin", "10:40", "13:10", "R.402", "IF253420", "R.01", "Sistem Terdistribusi", "3"],
        ["Selasa", "09:00", "11:30", "Lab Basis Data", "IF253422", "R.02", "Basis Data Lanjut", "3"],
        ["Kamis", "13:00", "15:30", "R.301", "IF253425", "R.01", "Kecerdasan Buatan", "3"],
    ]

    y = 125
    for r_idx, r in enumerate(rows):
        bg = (248, 250, 252) if r_idx % 2 == 1 else (255, 255, 255)
        draw.rectangle([(20, y), (1180, y + 40)], fill=bg, outline=(203, 213, 225))
        for i, val in enumerate(r):
            draw.text((col_x[i], y + 12), val, fill=(30, 41, 59))
        y += 45

    img.save(output_path, format="PNG")
    print(f"Generated schedule image: {output_path}")


# 4. Verified Ground Truth JSON
def generate_ground_truth(output_path: Path):
    truth = {
        "digital_schedule.pdf": {
            "documentType": "class_schedule",
            "insufficientForPersistence": False,
            "totalItems": 4,
            "items": [
                {
                    "namaMatkul": "Rekayasa Perangkat Lunak",
                    "hari": "Senin",
                    "waktuMulai": "08:00",
                    "waktuSelesai": "10:30",
                    "lokasi": "Lab RPL",
                    "kodeMatkul": "IF253418",
                    "kelas": "R.01",
                    "sks": 3,
                    "dosen": "Dr. Budi Santoso",
                    "recurrence": "weekly",
                },
                {
                    "namaMatkul": "Sistem Terdistribusi",
                    "hari": "Senin",
                    "waktuMulai": "10:40",
                    "waktuSelesai": "13:10",
                    "lokasi": "R.402",
                    "kodeMatkul": "IF253420",
                    "kelas": "R.01",
                    "sks": 3,
                    "dosen": "Prof. Hendra Wijaya",
                    "recurrence": "weekly",
                },
                {
                    "namaMatkul": "Basis Data Lanjut",
                    "hari": "Selasa",
                    "waktuMulai": "09:00",
                    "waktuSelesai": "11:30",
                    "lokasi": "Lab Basis Data",
                    "kodeMatkul": "IF253422",
                    "kelas": "R.02",
                    "sks": 3,
                    "dosen": "Ir. Siti Rahma M.T",
                    "recurrence": "weekly",
                },
                {
                    "namaMatkul": "Kecerdasan Buatan",
                    "hari": "Kamis",
                    "waktuMulai": "13:00",
                    "waktuSelesai": "15:30",
                    "lokasi": "R.301",
                    "kodeMatkul": "IF253425",
                    "kelas": "R.01",
                    "sks": 3,
                    "dosen": "Dr. Eng. Hendra",
                    "recurrence": "weekly",
                },
            ],
        },
        "scanned_schedule.pdf": {
            "documentType": "unknown",
            "insufficientForPersistence": True,
            "totalItems": 0,
            "items": [],
            "requiresVisionFallback": True,
        },
        "schedule_image.png": {
            "documentType": "class_schedule",
            "without_ocr": {
                "insufficientForPersistence": True,
                "totalItems": 0,
                "requiresVisionFallback": True,
            },
            "with_ocr": {
                "insufficientForPersistence": False,
                "totalItems": 4,
                "items": [
                    {
                        "namaMatkul": "Rekayasa Perangkat Lunak",
                        "hari": "Senin",
                        "waktuMulai": "08:00",
                        "waktuSelesai": "10:30",
                        "lokasi": "Lab RPL",
                        "kodeMatkul": "IF253418",
                        "kelas": "R.01",
                        "sks": 3,
                    },
                    {
                        "namaMatkul": "Sistem Terdistribusi",
                        "hari": "Senin",
                        "waktuMulai": "10:40",
                        "waktuSelesai": "13:10",
                        "lokasi": "R.402",
                        "kodeMatkul": "IF253420",
                        "kelas": "R.01",
                        "sks": 3,
                    },
                    {
                        "namaMatkul": "Basis Data Lanjut",
                        "hari": "Selasa",
                        "waktuMulai": "09:00",
                        "waktuSelesai": "11:30",
                        "lokasi": "Lab Basis Data",
                        "kodeMatkul": "IF253422",
                        "kelas": "R.02",
                        "sks": 3,
                    },
                    {
                        "namaMatkul": "Kecerdasan Buatan",
                        "hari": "Kamis",
                        "waktuMulai": "13:00",
                        "waktuSelesai": "15:30",
                        "lokasi": "R.301",
                        "kodeMatkul": "IF253425",
                        "kelas": "R.01",
                        "sks": 3,
                    },
                ],
            },
        },
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(truth, f, indent=2)
    print(f"Generated ground truth: {output_path}")


if __name__ == "__main__":
    generate_digital_pdf(OUTPUT_DIR / "digital_schedule.pdf")
    generate_scanned_pdf(OUTPUT_DIR / "scanned_schedule.pdf")
    generate_schedule_image(OUTPUT_DIR / "schedule_image.png")
    generate_ground_truth(OUTPUT_DIR / "ground_truth.json")
