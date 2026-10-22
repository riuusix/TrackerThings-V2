import XCTest
@testable import TrackerThings

final class AppleVisionOcrTests: XCTestCase {

    // MARK: - 1. LocalScheduleExtractor Standard Parsing
    func testLocalScheduleExtractor_standardRow() {
        let sampleLine = "IF253418 REKAYASA PERANGKAT LUNAK 3 SKS SENIN 08:00 - 10:30 LAB D.302 Dr. Ir. Budi"
        let item = LocalScheduleExtractor.parseScheduleLine(sampleLine, rowIndex: 1)

        XCTAssertNotNil(item, "Baris jadwal valid harus berhasil diparsing")
        guard let item = item else { return }

        XCTAssertEqual(item.namaMatkul, "REKAYASA PERANGKAT LUNAK")
        XCTAssertEqual(item.hari, "Senin")
        XCTAssertEqual(item.waktuMulai, "08:00")
        XCTAssertEqual(item.waktuSelesai, "10:30")
        XCTAssertEqual(item.sks, 3)
        XCTAssertEqual(item.kodeMatkul, "IF253418")
        XCTAssertEqual(item.lokasi, "LAB D.302")
        XCTAssertEqual(item.ruang, "LAB D.302")
        XCTAssertEqual(item.dosen, "Dr. Ir. Budi")
        XCTAssertFalse(item.needsReview, "Semua komponen esensial lengkap, tidak perlu review")
        XCTAssertEqual(item.reviewReasons?.count ?? 0, 0)
    }

    // MARK: - 2. Time Format Normalization & Day Aliases
    func testLocalScheduleExtractor_dotTimeFormatAndDayAliases() {
        let sampleLine = "CS201 STRUKTUR DATA 3 SKS Rab 07.30 - 09.10 R.201"
        let item = LocalScheduleExtractor.parseScheduleLine(sampleLine, rowIndex: 2)

        XCTAssertNotNil(item)
        guard let item = item else { return }

        XCTAssertEqual(item.namaMatkul, "STRUKTUR DATA")
        XCTAssertEqual(item.hari, "Rabu")
        XCTAssertEqual(item.waktuMulai, "07:30", "Format waktu bertitik '07.30' harus dinormalisasi menjadi '07:30'")
        XCTAssertEqual(item.waktuSelesai, "09:10")
        XCTAssertEqual(item.sks, 3)
        XCTAssertFalse(item.needsReview)
    }

    // MARK: - 3. Ambiguity & Missing Fields Flagging
    func testLocalScheduleExtractor_ambiguityFlagging() {
        let missingTimeLine = "PENGANTAR AI KAMIS LAB B101"
        let item = LocalScheduleExtractor.parseScheduleLine(missingTimeLine, rowIndex: 3)

        XCTAssertNotNil(item)
        guard let item = item else { return }

        XCTAssertEqual(item.namaMatkul, "PENGANTAR AI")
        XCTAssertEqual(item.hari, "Kamis")
        XCTAssertTrue(item.needsReview, "Item tanpa jam mulai/selesai harus ditandai needsReview = true")
        XCTAssertTrue(item.reviewReasons?.contains(where: { $0.contains("Jam mulai") || $0.contains("waktu") }) ?? false)
    }

    // MARK: - 4. Multi-line Full OCR Extraction
    func testLocalScheduleExtractor_fullOcrResult() {
        let ocrLines = [
            "KARTU RENCANA STUDI SEMESTER GENAP 2025/2026",
            "NO KODE MATA KULIAH SKS HARI WAKTU RUANG DOSEN",
            "1 IF201 ALGORITMA 3 SKS SENIN 08:00 - 10:00 LAB-1 Ir. Santoso",
            "2 IF202 BASIS DATA 3 SKS SELASA 10:00 - 12:00 LAB-2 Dr. Haryanto",
            "3 IF203 JARINGAN KOMPUTER 2 SKS JUMAT 13:30 - 15:10 R-304 Prof. Widodo"
        ]

        let localResult = LocalOcrResult(
            fullText: ocrLines.joined(separator: "\n"),
            lines: ocrLines,
            words: [],
            averageConfidence: 0.95,
            durationMs: 42.0
        )

        let items = LocalScheduleExtractor.extract(from: localResult)
        XCTAssertEqual(items.count, 3, "Harus mengabaikan header dan mengekstrak tepat 3 mata kuliah")

        XCTAssertEqual(items[0].namaMatkul, "ALGORITMA")
        XCTAssertEqual(items[0].hari, "Senin")
        XCTAssertEqual(items[1].namaMatkul, "BASIS DATA")
        XCTAssertEqual(items[1].hari, "Selasa")
        XCTAssertEqual(items[2].namaMatkul, "JARINGAN KOMPUTER")
        XCTAssertEqual(items[2].hari, "Jumat")
    }

    // MARK: - 5. Coordinate Inversion & BoundingBox Normalization
    func testOcrBoundingBox_coordinateNormalization() {
        // Vision coordinate: origin (0,0) is bottom-left
        // Normalized width=0.4, height=0.05, minX=0.15, minY=0.70 -> maxY = 0.75
        let minX = 0.15
        let maxX = 0.55
        let minY = 0.70
        let maxY = 0.75

        // Inversion to top-left origin:
        let y0 = 1.0 - maxY // 1.0 - 0.75 = 0.25
        let y1 = 1.0 - minY // 1.0 - 0.70 = 0.30

        let bbox = OcrBoundingBox(x0: minX, y0: y0, x1: maxX, y1: y1)

        XCTAssertEqual(bbox.x0, 0.15, accuracy: 0.0001)
        XCTAssertEqual(bbox.x1, 0.55, accuracy: 0.0001)
        XCTAssertEqual(bbox.y0, 0.25, accuracy: 0.0001)
        XCTAssertEqual(bbox.y1, 0.30, accuracy: 0.0001)
    }

    // MARK: - 6. OfflineScheduleDraft Serialization & Persistence Fidelity
    func testOfflineScheduleDraft_serializationFidelity() throws {
        let testItem = ImportScheduleItem(
            namaMatkul: "SISTEM TERDISTRIBUSI",
            hari: "Rabu",
            waktuMulai: "09:00",
            waktuSelesai: "11:30",
            ruang: "R.401",
            lokasi: "R.401",
            dosen: "Dr. Budi",
            sks: 3,
            kodeMatkul: "IF310",
            kelas: "A",
            confidence: 0.92,
            needsReview: false
        )

        let draft = OfflineScheduleDraft(
            id: "draft-test-123",
            fileName: "krs_offline_photo.jpg",
            createdAt: Date(),
            updatedAt: Date(),
            items: [testItem],
            status: .pendingSync,
            syncErrorMessage: nil
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let encodedData = try encoder.encode(draft)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decodedDraft = try decoder.decode(OfflineScheduleDraft.self, from: encodedData)

        XCTAssertEqual(decodedDraft.id, "draft-test-123")
        XCTAssertEqual(decodedDraft.fileName, "krs_offline_photo.jpg")
        XCTAssertEqual(decodedDraft.status, .pendingSync)
        XCTAssertEqual(decodedDraft.items.count, 1)
        XCTAssertEqual(decodedDraft.items[0].namaMatkul, "SISTEM TERDISTRIBUSI")
        XCTAssertEqual(decodedDraft.items[0].hari, "Rabu")
        XCTAssertEqual(decodedDraft.items[0].waktuMulai, "09:00")
        XCTAssertEqual(decodedDraft.items[0].sks, 3)
    }

    // MARK: - 7. Deduplication Logic on Sync
    func testScheduleDeduplicationKeyMatching() {
        let existingCourse = JadwalItem(
            id: "existing-1",
            namaMatkul: "Rekayasa Perangkat Lunak",
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            ruang: "LAB D.302",
            dosen: "Dr. Ir. Budi",
            sks: 3,
            warna: "#3B82F6"
        )

        let duplicateCandidate = ImportScheduleItem(
            namaMatkul: "  rekayasa perangkat lunak  ",
            hari: "senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:30"
        )

        let differentCourse = ImportScheduleItem(
            namaMatkul: "Kecerdasan Buatan",
            hari: "Senin",
            waktuMulai: "10:30",
            waktuSelesai: "12:00"
        )

        func makeKey(name: String, day: String, start: String) -> String {
            "\(name.lowercased().trimmingCharacters(in: .whitespaces))_\(day.lowercased().trimmingCharacters(in: .whitespaces))_\(start.trimmingCharacters(in: .whitespaces))"
        }

        let existingKey = makeKey(name: existingCourse.namaMatkul, day: existingCourse.hari, start: existingCourse.waktuMulai)
        let dupKey = makeKey(name: duplicateCandidate.namaMatkul, day: duplicateCandidate.hari, start: duplicateCandidate.waktuMulai)
        let diffKey = makeKey(name: differentCourse.namaMatkul, day: differentCourse.hari, start: differentCourse.waktuMulai)

        XCTAssertEqual(existingKey, dupKey, "Item dengan nama, hari, dan waktu sama harus terdeteksi sebagai duplikat")
        XCTAssertNotEqual(existingKey, diffKey, "Item berbeda tidak boleh dianggap duplikat")
    }

    // MARK: - 8. Cross-Platform Envelope & Layout Decoding Tests
    func testScheduleImportPreviewResponse_standardApiEnvelopeDecoding() throws {
        let jsonString = """
        {
            "success": true,
            "message": "Ekstraksi jadwal berhasil. Ditemukan 2 mata kuliah.",
            "code": 200,
            "data": {
                "draft_id": "draft-pdf-123",
                "draft_version": 1,
                "version": "2.0",
                "document_type": "class_schedule",
                "processing_mode": "deterministic",
                "engineUsed": "typescript_parser",
                "processingStage": "typescript_initial",
                "qualityStatus": "sufficient",
                "warnings": [],
                "visionFallbackEligible": false,
                "layout": {
                    "kind": "unas_8col_table",
                    "label": "Tabel UNAS 8 Kolom",
                    "hasRecognizedHeaders": true,
                    "detectedColumns": ["no", "hari", "waktuMulai", "waktuSelesai", "kode", "nama", "sks", "ruang"]
                },
                "items": [
                    {
                        "id": "item-1",
                        "namaMatkul": "Rekayasa Perangkat Lunak",
                        "kodeMatkul": "IF253418",
                        "kelas": "A",
                        "hari": "Senin",
                        "waktuMulai": "08:00",
                        "waktuSelesai": "10:30",
                        "dosen": "Dr. Ir. Budi",
                        "ruang": "R.301",
                        "lokasi": "R.301",
                        "sks": 3,
                        "kategori": "Wajib",
                        "needsReview": false,
                        "confidence": 0.95,
                        "recognitionStatus": "high_confidence"
                    },
                    {
                        "id": "item-2",
                        "namaMatkul": "Struktur Data",
                        "kodeMatkul": "IF253420",
                        "kelas": "B",
                        "hari": "Selasa",
                        "waktuMulai": "10:00",
                        "waktuSelesai": "11:40",
                        "dosen": "Dr. Haryanto",
                        "ruang": "Lab. 2",
                        "lokasi": "Lab. 2",
                        "sks": 3,
                        "kategori": "Wajib",
                        "needsReview": false,
                        "confidence": 0.95,
                        "recognitionStatus": "high_confidence"
                    }
                ],
                "total": 2,
                "requires_review": false,
                "insufficient_for_production": false,
                "filename": "jadwal_kuliah.pdf"
            }
        }
        """

        let data = Data(jsonString.utf8)
        let decoder = JSONDecoder()

        // 1. Direct decode from top-level envelope
        let decoded = try decoder.decode(ScheduleImportPreviewResponse.self, from: data)

        XCTAssertEqual(decoded.items.count, 2, "Decoder harus mampu meng-unwrap objek dari envelope data")
        XCTAssertEqual(decoded.total, 2)
        XCTAssertEqual(decoded.draftId, "draft-pdf-123")
        XCTAssertEqual(decoded.draftVersion, 1)
        XCTAssertEqual(decoded.layout, "unas_8col_table", "Decoder harus mengekstrak string kind dari layout object")
        XCTAssertEqual(decoded.items[0].namaMatkul, "Rekayasa Perangkat Lunak")
        XCTAssertEqual(decoded.items[0].hari, "Senin")
        XCTAssertEqual(decoded.items[0].waktuMulai, "08:00")
        XCTAssertEqual(decoded.items[0].waktuSelesai, "10:30")
        XCTAssertEqual(decoded.items[0].ruang, "R.301")
        XCTAssertEqual(decoded.items[1].namaMatkul, "Struktur Data")
        XCTAssertEqual(decoded.items[1].hari, "Selasa")
        XCTAssertFalse(decoded.insufficientForProduction)
    }

    func testScheduleImportPreviewResponse_directPayloadDecoding() throws {
        let jsonString = """
        {
            "items": [
                {
                    "id": "direct-1",
                    "namaMatkul": "Kecerdasan Buatan",
                    "hari": "Rabu",
                    "waktuMulai": "13:00",
                    "waktuSelesai": "15:30",
                    "ruang": "Lab AI",
                    "sks": 3
                }
            ],
            "total": 1,
            "requires_review": false,
            "layout": "simple_table",
            "draft_id": "draft-direct-456",
            "insufficient_for_production": false,
            "vision_fallback_eligible": false
        }
        """

        let data = Data(jsonString.utf8)
        let decoded = try JSONDecoder().decode(ScheduleImportPreviewResponse.self, from: data)

        XCTAssertEqual(decoded.items.count, 1)
        XCTAssertEqual(decoded.layout, "simple_table")
        XCTAssertEqual(decoded.draftId, "draft-direct-456")
        XCTAssertEqual(decoded.items[0].namaMatkul, "Kecerdasan Buatan")
        XCTAssertEqual(decoded.items[0].hari, "Rabu")
        XCTAssertEqual(decoded.items[0].waktuMulai, "13:00")
        XCTAssertEqual(decoded.items[0].waktuSelesai, "15:30")
        XCTAssertEqual(decoded.items[0].ruang, "Lab AI")
    }
}
