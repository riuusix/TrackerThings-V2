# TrackerThings V2 — Academic Dataset Collection, Privacy, and Evaluation Protocol

## 1. Overview and Ethical Boundary

The TrackerThings Academic Intelligence Engine is designed to extract university schedule structures from heterogeneous academic documents. Because academic documents often contain personally identifiable information (PII) such as student full names, student identification numbers (NIM / NPM), academic advisor names, birth dates, photographs, barcodes, and matriculation records, strict privacy protocols are enforced across all development and benchmarking workflows.

## 2. Core Privacy Principles

1. **Zero Real Student PII in Git**:
   - Real student documents, un-redacted scans, photographs, and personal credentials must **never** be committed to the Git repository or published in CI artifacts.
   - All repository fixtures in `datasets/fixtures/` are strictly synthetic or derived from authorized, completely redacted templates.
2. **Permissioned Collection Protocol**:
   - Documents contributed by beta testers or university volunteers require explicit informed consent.
   - Contributors must be informed that documents are used exclusively for layout evaluation and metric benchmarking.
   - User documents collected in production imports are processed in-memory and **never** retained for model training without separate, explicit opt-in.
3. **Automated & Manual PII Sanitization**:
   Before any real document is added to the held-out offline benchmark set:
   - Student Name: Replaced with synthetic names (e.g. `Mahasiswa Contoh`).
   - Student ID (NIM/NPM): Replaced with synthetic identifiers (e.g. `2026100001`).
   - Personal details (address, email, phone number, signatures): Blacked out or removed.
   - QR codes and barcodes: Removed or scrambled.
   - Only structural schedule tables (Course Name, Day, Time, Room, Code, SKS) are retained for annotation.

## 3. Dataset Composition & Split Strategy

The evaluation framework partitions documents into three isolated splits:
- **Development Set (`dev`)**: Used during iterative rule development, regex tuning, and error analysis.
- **Test Set (`test`)**: Held-out split used to evaluate generalizability across layout families.
- **Split Rule**: Partitioning is performed by **template family and university**, not by randomly splitting nearly identical documents across splits. This prevents artificial overfitting to a single university's layout.

## 4. Evaluation Metrics & Standards

The benchmark harness measures:
1. **Field-Level Exact Accuracy**: Proportion of fields (`namaMatkul`, `hari`, `waktuMulai`, `waktuSelesai`, `kodeMatkul`, `sks`, `tanggal`, `recurrence`) exactly matching ground truth.
2. **Exact-Record Accuracy**: Proportion of rows where every single required field matches ground truth without error.
3. **Hallucination / Unsupported Value Rate**: Percentage of extracted rows that were not present in the source document.
4. **Time & Date Consistency**: Strict check ensuring `waktuMulai < waktuSelesai` and dates follow ISO 8601 calendar format.
5. **Processing Latency**: Measured in milliseconds per document.

