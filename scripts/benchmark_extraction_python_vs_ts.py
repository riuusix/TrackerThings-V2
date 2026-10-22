import os
import sys
import time
import json
import tracemalloc
import re
from typing import List, Dict, Any, Optional

# Ensure repository root is on sys.path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import fitz # PyMuPDF
except ImportError:
    fitz = None

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None

from api.extractor import extract_academic_document

# Load Ground Truth
GROUND_TRUTH_PATH = "datasets/test_set/ground_truth.json"
with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
    ground_truth = json.load(f)

# Ground truth for Jadwal_Kuliah_Arsitektur.pdf
ground_truth["Jadwal_Kuliah_Arsitektur.pdf"] = {
    "documentType": "class_schedule",
    "totalItems": 8,
    "items": [
        {"namaMatkul": "Struktur & Konstruksi Bangunan 2", "hari": "Senin", "waktuMulai": "08:00", "waktuSelesai": "10:30", "lokasi": "R. G301", "kodeMatkul": "ARS-301", "sks": 3, "dosen": "Ir. Budi Santoso, M.T."},
        {"namaMatkul": "Sejarah & Teori Arsitektur 2", "hari": "Senin", "waktuMulai": "13:00", "waktuSelesai": "15:30", "lokasi": "R. G302", "kodeMatkul": "ARS-303", "sks": 3, "dosen": "Dr. Dina Marlina, IAI"},
        {"namaMatkul": "Studio Perancangan Arsitektur 3", "hari": "Selasa", "waktuMulai": "08:00", "waktuSelesai": "13:00", "lokasi": "Studio A", "kodeMatkul": "ARS-305", "sks": 6, "dosen": "Ar. Hendra Wijaya, M.Arch. Tim Dosen Studio"},
        {"namaMatkul": "Fisika Bangunan", "hari": "Rabu", "waktuMulai": "09:00", "waktuSelesai": "11:30", "lokasi": "R. G205", "kodeMatkul": "ARS-307", "sks": 3, "dosen": "Dr. Eng. Rina Amelia"},
        {"namaMatkul": "Utilitas Bangunan", "hari": "Rabu", "waktuMulai": "13:00", "waktuSelesai": "14:40", "lokasi": "R. G205", "kodeMatkul": "ARS-309", "sks": 2, "dosen": "Ir. Ahmad Fauzi, M.T."},
        {"namaMatkul": "Aplikasi Komputer Arsitektur", "hari": "Kamis", "waktuMulai": "08:00", "waktuSelesai": "10:30", "lokasi": "Lab. Komputer", "kodeMatkul": "ARS-311", "sks": 3, "dosen": "Bagus Pramono, S.T., M.Ds."},
        {"namaMatkul": "Pendidikan Kewarganegaraan", "hari": "Kamis", "waktuMulai": "13:00", "waktuSelesai": "14:40", "lokasi": "R. MKU101", "kodeMatkul": "MKU-104", "sks": 2, "dosen": "Drs. Yudi Haryanto, M.Pd."},
        {"namaMatkul": "Material Arsitektur", "hari": "Jumat", "waktuMulai": "08:00", "waktuSelesai": "09:40", "lokasi": "R. G301", "kodeMatkul": "ARS-313", "sks": 2, "dosen": "Siti Nurbaya, S.T., M.Sc."}
    ]
}

def normalize_str(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"[^a-zA-Z0-9]", "", str(s)).lower()

def match_item(extracted: Dict[str, Any], gt: Dict[str, Any]) -> bool:
    name_e = normalize_str(extracted.get("namaMatkul"))
    name_g = normalize_str(gt.get("namaMatkul"))
    code_e = normalize_str(extracted.get("kodeMatkul"))
    code_g = normalize_str(gt.get("kodeMatkul"))
    
    if code_e and code_g and code_e == code_g:
        return True
    if name_e and name_g and (name_e in name_g or name_g in name_e):
        return True
    return False

def evaluate_extracted_items(extracted_list: List[Dict[str, Any]], gt_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    matched_pairs = []
    unmatched_gt = list(range(len(gt_list)))
    false_rows = 0
    
    for ext_idx, ext in enumerate(extracted_list):
        matched = False
        for gt_idx in unmatched_gt:
            gt = gt_list[gt_idx]
            if match_item(ext, gt):
                matched_pairs.append((ext, gt))
                unmatched_gt.remove(gt_idx)
                matched = True
                break
        if not matched:
            false_rows += 1
            
    # Field-level evaluation on matched pairs
    field_counts = {
        "namaMatkul": {"correct": 0, "total": len(gt_list)},
        "hari": {"correct": 0, "total": len(gt_list)},
        "waktuMulai": {"correct": 0, "total": len(gt_list)},
        "waktuSelesai": {"correct": 0, "total": len(gt_list)},
        "lokasi": {"correct": 0, "total": len(gt_list)},
        "kodeMatkul": {"correct": 0, "total": len(gt_list)},
        "sks": {"correct": 0, "total": len(gt_list)},
    }
    
    complete_rows = 0
    
    for ext, gt in matched_pairs:
        is_row_complete = True
        
        # namaMatkul
        if normalize_str(ext.get("namaMatkul")) == normalize_str(gt.get("namaMatkul")):
            field_counts["namaMatkul"]["correct"] += 1
        else:
            is_row_complete = False
            
        # hari
        if normalize_str(ext.get("hari")) == normalize_str(gt.get("hari")):
            field_counts["hari"]["correct"] += 1
        else:
            is_row_complete = False
            
        # waktuMulai
        if (ext.get("waktuMulai") or "").replace(".", ":") == (gt.get("waktuMulai") or "").replace(".", ":"):
            field_counts["waktuMulai"]["correct"] += 1
        else:
            is_row_complete = False
            
        # waktuSelesai
        if (ext.get("waktuSelesai") or "").replace(".", ":") == (gt.get("waktuSelesai") or "").replace(".", ":"):
            field_counts["waktuSelesai"]["correct"] += 1
        else:
            is_row_complete = False
            
        # lokasi
        loc_e = normalize_str(ext.get("lokasi"))
        loc_g = normalize_str(gt.get("lokasi"))
        if loc_e and loc_g and (loc_e in loc_g or loc_g in loc_e):
            field_counts["lokasi"]["correct"] += 1
        elif not loc_e and not loc_g:
            field_counts["lokasi"]["correct"] += 1
        else:
            is_row_complete = False
            
        # kodeMatkul
        kd_e = normalize_str(ext.get("kodeMatkul"))
        kd_g = normalize_str(gt.get("kodeMatkul"))
        if kd_e and kd_g and kd_e == kd_g:
            field_counts["kodeMatkul"]["correct"] += 1
        elif not kd_e and not kd_g:
            field_counts["kodeMatkul"]["correct"] += 1
        else:
            is_row_complete = False
            
        # sks
        if ext.get("sks") == gt.get("sks"):
            field_counts["sks"]["correct"] += 1
        else:
            is_row_complete = False
            
        if is_row_complete:
            complete_rows += 1
            
    if len(gt_list) == 0:
        is_clean = (len(extracted_list) == 0)
        return {
            "precision": 100.0 if is_clean else 0.0,
            "recall": 100.0 if is_clean else 0.0,
            "f1": 100.0 if is_clean else 0.0,
            "field_accuracy": 100.0 if is_clean else 0.0,
            "complete_row_accuracy": 100.0 if is_clean else 0.0,
            "complete_rows": 0,
            "matched_rows": 0,
            "total_gt_rows": 0,
            "extracted_rows": len(extracted_list),
            "false_rows": len(extracted_list),
            "missing_rows": 0,
            "field_breakdown": {k: "N/A (Empty ground truth)" for k in field_counts.keys()}
        }
    total_fields = sum(f["total"] for f in field_counts.values())
    correct_fields = sum(f["correct"] for f in field_counts.values())
    
    tp = len(matched_pairs)
    fp = false_rows
    fn = len(unmatched_gt)
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    
    return {
        "precision": round(precision * 100, 1),
        "recall": round(recall * 100, 1),
        "f1": round(f1 * 100, 1),
        "field_accuracy": round(correct_fields / total_fields * 100, 1) if total_fields > 0 else 0.0,
        "complete_row_accuracy": round(complete_rows / len(gt_list) * 100, 1) if len(gt_list) > 0 else 0.0,
        "complete_rows": complete_rows,
        "matched_rows": len(matched_pairs),
        "total_gt_rows": len(gt_list),
        "extracted_rows": len(extracted_list),
        "false_rows": false_rows,
        "missing_rows": len(unmatched_gt),
        "field_breakdown": {
            k: f"{v['correct']}/{v['total']} ({round(v['correct']/v['total']*100, 1) if v['total'] > 0 else 100.0}%)"
            for k, v in field_counts.items()
        }
    }

def run_benchmark():
    docs_to_test = [
        ("datasets/test_set/digital_schedule.pdf", "digital_schedule.pdf", "digital_pdf"),
        ("C:/Users/Budy/Downloads/Jadwal_Kuliah_Arsitektur.pdf", "Jadwal_Kuliah_Arsitektur.pdf", "complex_digital_pdf"),
        ("datasets/test_set/scanned_schedule.pdf", "scanned_schedule.pdf", "scanned_pdf"),
        ("datasets/test_set/schedule_image.png", "schedule_image.png", "image")
    ]
    
    print("=" * 80)
    print("TRACKERTHINGS V2: COMPREHENSIVE MULTI-TOOL EXTRACTION BENCHMARK")
    print("=" * 80)
    
    benchmark_results = {}
    
    for file_path, doc_id, doc_type in docs_to_test:
        if not os.path.exists(file_path):
            print(f"[SKIP] File not found: {file_path}")
            continue
            
        print(f"\n>>> BENCHMARKING DOCUMENT: {doc_id} ({doc_type}) <<<")
        gt_data = ground_truth[doc_id]
        gt_items = gt_data.get("items") or gt_data.get("with_ocr", {}).get("items", [])
        
        with open(file_path, "rb") as f:
            file_bytes = f.read()
            
        doc_results = {}
        
        # 1. Existing Python Extractor (api/extractor.py)
        tracemalloc.start()
        t0 = time.perf_counter()
        try:
            mime = "application/pdf" if file_path.endswith(".pdf") else "image/png"
            py_res = extract_academic_document(file_bytes, mime, doc_id)
            py_items = [it.model_dump() for it in py_res.items]
            status_1 = "OK"
        except Exception as e:
            py_items = []
            status_1 = f"ERROR: {str(e)[:40]}"
        t1 = time.perf_counter()
        _, peak_mem_1 = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        eval_1 = evaluate_extracted_items(py_items, gt_items)
        doc_results["api_extractor_py"] = {
            "status": status_1,
            "duration_ms": round((t1 - t0) * 1000, 2),
            "memory_kb": round(peak_mem_1 / 1024, 1),
            "eval": eval_1
        }
        
        # 2. Enhanced pdfplumber Table Extractor (Python)
        if pdfplumber and file_path.endswith(".pdf"):
            tracemalloc.start()
            t0 = time.perf_counter()
            plumber_items = []
            try:
                import io
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    for page in pdf.pages:
                        tables = page.extract_tables() or []
                        for table in tables:
                            if not table or len(table) < 2:
                                continue
                            header = [re.sub(r"\s+", " ", str(c or "")).strip().lower() for c in table[0]]
                            # Map columns
                            col_map = {}
                            for idx, h in enumerate(header):
                                if "hari" in h or "day" in h: col_map["hari"] = idx
                                elif "waktu" in h or "jam" in h: col_map["waktu"] = idx
                                elif "mulai" in h: col_map["mulai"] = idx
                                elif "akhir" in h or "selesai" in h: col_map["selesai"] = idx
                                elif "ruang" in h or "lokasi" in h: col_map["lokasi"] = idx
                                elif "sks" in h: col_map["sks"] = idx
                                elif "dosen" in h or "pengampu" in h: col_map["dosen"] = idx
                                elif "mata kuliah" in h or "matakuliah" in h or "nama mk" in h: col_map["nama"] = idx
                                elif "kode" in h: col_map["kode"] = idx
                                
                            last_day = ""
                            for row in table[1:]:
                                raw_day = re.sub(r"\s+", " ", str(row[col_map.get("hari", 0)] or "")).strip() if "hari" in col_map else ""
                                day = raw_day if raw_day else last_day
                                if raw_day: last_day = raw_day
                                
                                # Time
                                waktu_mulai = ""
                                waktu_selesai = ""
                                if "waktu" in col_map:
                                    t_str = str(row[col_map["waktu"]] or "")
                                    m = re.search(r"(\d{2}[:.]\d{2})\s*-\s*(\d{2}[:.]\d{2})", t_str)
                                    if m:
                                        waktu_mulai = m.group(1).replace(".", ":")
                                        waktu_selesai = m.group(2).replace(".", ":")
                                else:
                                    if "mulai" in col_map: waktu_mulai = str(row[col_map["mulai"]] or "").strip()
                                    if "selesai" in col_map: waktu_selesai = str(row[col_map["selesai"]] or "").strip()
                                    
                                if not waktu_mulai and not waktu_selesai:
                                    continue
                                    
                                # Course & Code
                                course_cell = str(row[col_map.get("nama", 2)] or "")
                                code_cell = str(row[col_map["kode"]] or "") if "kode" in col_map else ""
                                if not code_cell:
                                    m_code = re.search(r"([A-Z]{2,4}[-\s]?\d{3,6})", course_cell)
                                    if m_code:
                                        code_cell = m_code.group(1)
                                        course_cell = re.sub(r"([A-Z]{2,4}[-\s]?\d{3,6})|\(Mata Kuliah Inti\)", "", course_cell)
                                nama_clean = re.sub(r"\s+", " ", course_cell).strip()
                                
                                dosen_cell = re.sub(r"\s+", " ", str(row[col_map.get("dosen", 3)] or "")).strip() if "dosen" in col_map else ""
                                ruang_cell = re.sub(r"\s+", " ", str(row[col_map.get("lokasi", 4)] or "")).strip() if "lokasi" in col_map else ""
                                sks_val = 0
                                if "sks" in col_map:
                                    s_str = str(row[col_map["sks"]] or "")
                                    m_sks = re.search(r"\d+", s_str)
                                    if m_sks: sks_val = int(m_sks.group(0))
                                    
                                plumber_items.append({
                                    "namaMatkul": nama_clean,
                                    "kodeMatkul": code_cell,
                                    "hari": day,
                                    "waktuMulai": waktu_mulai,
                                    "waktuSelesai": waktu_selesai,
                                    "dosen": dosen_cell,
                                    "lokasi": ruang_cell,
                                    "sks": sks_val
                                })
                status_2 = "OK"
            except Exception as e:
                status_2 = f"ERROR: {str(e)[:40]}"
            t1 = time.perf_counter()
            _, peak_mem_2 = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            
            eval_2 = evaluate_extracted_items(plumber_items, gt_items)
            doc_results["enhanced_pdfplumber"] = {
                "status": status_2,
                "duration_ms": round((t1 - t0) * 1000, 2),
                "memory_kb": round(peak_mem_2 / 1024, 1),
                "eval": eval_2
            }
            
        # 3. PyMuPDF Table Extractor (fitz)
        if fitz and file_path.endswith(".pdf"):
            tracemalloc.start()
            t0 = time.perf_counter()
            mupdf_items = []
            try:
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for page in doc:
                    tabs = page.find_tables()
                    for t in tabs.tables:
                        df = t.extract()
                        if not df or len(df) < 2:
                            continue
                        last_day = ""
                        for row in df[1:]:
                            raw_day = re.sub(r"\s+", " ", str(row[0] or "")).strip()
                            day = raw_day if raw_day else last_day
                            if raw_day: last_day = raw_day
                            
                            t_str = str(row[1] or "")
                            m = re.search(r"(\d{2}[:.]\d{2})\s*-\s*(\d{2}[:.]\d{2})", t_str)
                            w_mulai = m.group(1).replace(".", ":") if m else ""
                            w_selesai = m.group(2).replace(".", ":") if m else ""
                            if not w_mulai: continue
                            
                            course_cell = str(row[2] or "")
                            dosen_cell = str(row[3] or "")
                            ruang_cell = str(row[4] or "")
                            sks_str = str(row[5] or "") if len(row) > 5 else "0"
                            m_sks = re.search(r"\d+", sks_str)
                            sks_val = int(m_sks.group(0)) if m_sks else 0
                            
                            mupdf_items.append({
                                "namaMatkul": re.sub(r"\s+", " ", course_cell).strip(),
                                "kodeMatkul": None,
                                "hari": day,
                                "waktuMulai": w_mulai,
                                "waktuSelesai": w_selesai,
                                "dosen": re.sub(r"\s+", " ", dosen_cell).strip(),
                                "lokasi": re.sub(r"\s+", " ", ruang_cell).strip(),
                                "sks": sks_val
                            })
                status_3 = "OK"
            except Exception as e:
                status_3 = f"ERROR: {str(e)[:40]}"
            t1 = time.perf_counter()
            _, peak_mem_3 = tracemalloc.get_traced_memory()
            tracemalloc.stop()
            
            eval_3 = evaluate_extracted_items(mupdf_items, gt_items)
            doc_results["pymupdf_table"] = {
                "status": status_3,
                "duration_ms": round((t1 - t0) * 1000, 2),
                "memory_kb": round(peak_mem_3 / 1024, 1),
                "eval": eval_3
            }
            
        benchmark_results[doc_id] = doc_results
        
    print("\n" + "=" * 80)
    print("FINAL BENCHMARK SUMMARY TABLE")
    print("=" * 80)
    for doc_id, tools in benchmark_results.items():
        print(f"\nDocument: {doc_id}")
        print(f"{'Extractor Tool':<25} | {'F1':<6} | {'Field Acc':<10} | {'Row Acc':<8} | {'Rows':<7} | {'Duration':<10} | {'Memory'}")
        print("-" * 80)
        for tool_name, data in tools.items():
            ev = data["eval"]
            rows_str = f"{ev['matched_rows']}/{ev['total_gt_rows']}"
            dur_str = f"{data['duration_ms']}ms"
            mem_str = f"{data['memory_kb']}KB"
            print(f"{tool_name:<25} | {ev['f1']}% | {ev['field_accuracy']}% | {ev['complete_row_accuracy']}% | {rows_str:<7} | {dur_str:<10} | {mem_str}")

if __name__ == "__main__":
    run_benchmark()
