import Foundation

/// Model item jadwal hasil ekstraksi OCR / AI Vision yang dapat ditinjau dan diedit pengguna.
public struct ImportScheduleItem: Codable, Sendable, Identifiable, Hashable {
    public var id: String
    public var namaMatkul: String
    public var kodeMatkul: String?
    public var kelas: String?
    public var hari: String
    public var waktuMulai: String
    public var waktuSelesai: String
    public var dosen: String?
    public var ruang: String?
    public var lokasi: String?
    public var sks: Int?
    public var kategori: String?
    public var needsReview: Bool
    public var confidence: Double?
    public var recognitionStatus: String?
    public var fieldConfidence: [String: Double]?
    public var reviewReasons: [String]?
    public var rawFields: [String: String]?

    enum CodingKeys: String, CodingKey {
        case id
        case namaMatkul = "namaMatkul"
        case namaMatkulAlt = "nama_matkul"
        case kodeMatkul = "kodeMatkul"
        case kodeMatkulAlt = "kode_matkul"
        case kelas
        case hari
        case waktuMulai = "waktuMulai"
        case waktuMulaiAlt = "waktu_mulai"
        case waktuSelesai = "waktuSelesai"
        case waktuSelesaiAlt = "waktu_selesai"
        case dosen
        case ruang
        case lokasi
        case sks
        case kategori
        case needsReview = "needsReview"
        case needsReviewAlt = "needs_review"
        case confidence
        case recognitionStatus = "recognitionStatus"
        case recognitionStatusAlt = "recognition_status"
        case fieldConfidence = "fieldConfidence"
        case fieldConfidenceAlt = "field_confidence"
        case reviewReasons = "reviewReasons"
        case reviewReasonsAlt = "review_reasons"
        case rawFields = "rawFields"
        case rawFieldsAlt = "raw_fields"
    }

    public init(
        id: String = UUID().uuidString,
        namaMatkul: String,
        kodeMatkul: String? = nil,
        kelas: String? = nil,
        hari: String = "",
        waktuMulai: String = "",
        waktuSelesai: String = "",
        dosen: String? = nil,
        ruang: String? = nil,
        lokasi: String? = nil,
        sks: Int? = 2,
        kategori: String? = "Wajib",
        needsReview: Bool = false,
        confidence: Double? = 0.9,
        recognitionStatus: String? = "high_confidence",
        fieldConfidence: [String: Double]? = nil,
        reviewReasons: [String]? = nil,
        rawFields: [String: String]? = nil
    ) {
        self.id = id
        self.namaMatkul = namaMatkul
        self.kodeMatkul = kodeMatkul
        self.kelas = kelas
        self.hari = hari
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.dosen = dosen
        self.ruang = ruang
        self.lokasi = lokasi ?? ruang
        self.sks = sks
        self.kategori = kategori
        let missingRequired = namaMatkul.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || hari.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || waktuMulai.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || waktuSelesai.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        self.needsReview = needsReview || missingRequired
        self.confidence = confidence
        self.recognitionStatus = recognitionStatus
        self.fieldConfidence = fieldConfidence
        self.reviewReasons = reviewReasons
        self.rawFields = rawFields
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // ID decoding with fallback
        if let idStr = try? container.decode(String.self, forKey: .id) {
            self.id = idStr
        } else if let idInt = try? container.decode(Int.self, forKey: .id) {
            self.id = String(idInt)
        } else {
            self.id = UUID().uuidString
        }

        // Nama Matkul
        self.namaMatkul = (try? container.decode(String.self, forKey: .namaMatkul))
            ?? (try? container.decode(String.self, forKey: .namaMatkulAlt))
            ?? ""

        // Kode Matkul & Kelas
        self.kodeMatkul = (try? container.decode(String.self, forKey: .kodeMatkul))
            ?? (try? container.decode(String.self, forKey: .kodeMatkulAlt))
        self.kelas = try? container.decode(String.self, forKey: .kelas)

        // Hari (Never silently default to "Senin" when missing)
        self.hari = (try? container.decode(String.self, forKey: .hari)) ?? ""

        // Waktu (Never silently default to "08:00" or "10:00" when missing)
        self.waktuMulai = (try? container.decode(String.self, forKey: .waktuMulai))
            ?? (try? container.decode(String.self, forKey: .waktuMulaiAlt))
            ?? ""
        self.waktuSelesai = (try? container.decode(String.self, forKey: .waktuSelesai))
            ?? (try? container.decode(String.self, forKey: .waktuSelesaiAlt))
            ?? ""

        // Dosen, Ruang, Lokasi
        self.dosen = try? container.decode(String.self, forKey: .dosen)
        self.ruang = try? container.decode(String.self, forKey: .ruang)
        self.lokasi = (try? container.decode(String.self, forKey: .lokasi)) ?? self.ruang

        // SKS (number or string)
        if let sksInt = try? container.decode(Int.self, forKey: .sks) {
            self.sks = sksInt
        } else if let sksStr = try? container.decode(String.self, forKey: .sks), let parsed = Int(sksStr) {
            self.sks = parsed
        } else {
            self.sks = nil
        }

        // Kategori
        self.kategori = (try? container.decode(String.self, forKey: .kategori)) ?? "Wajib"

        // Needs Review
        let decodedNeedsReview = (try? container.decode(Bool.self, forKey: .needsReview))
            ?? (try? container.decode(Bool.self, forKey: .needsReviewAlt))
            ?? false
        let missingRequired = self.namaMatkul.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || self.hari.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || self.waktuMulai.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || self.waktuSelesai.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        self.needsReview = decodedNeedsReview || missingRequired

        // Confidence
        if let conf = try? container.decode(Double.self, forKey: .confidence) {
            self.confidence = conf
        } else {
            self.confidence = nil
        }

        // Recognition Status
        self.recognitionStatus = (try? container.decode(String.self, forKey: .recognitionStatus))
            ?? (try? container.decode(String.self, forKey: .recognitionStatusAlt))

        // Field Confidence
        self.fieldConfidence = (try? container.decode([String: Double].self, forKey: .fieldConfidence))
            ?? (try? container.decode([String: Double].self, forKey: .fieldConfidenceAlt))

        // Review Reasons
        self.reviewReasons = (try? container.decode([String].self, forKey: .reviewReasons))
            ?? (try? container.decode([String].self, forKey: .reviewReasonsAlt))

        // Raw Fields
        self.rawFields = (try? container.decode([String: String].self, forKey: .rawFields))
            ?? (try? container.decode([String: String].self, forKey: .rawFieldsAlt))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(namaMatkul, forKey: .namaMatkul)
        try container.encode(kodeMatkul, forKey: .kodeMatkul)
        try container.encode(kelas, forKey: .kelas)
        try container.encode(hari, forKey: .hari)
        try container.encode(waktuMulai, forKey: .waktuMulai)
        try container.encode(waktuSelesai, forKey: .waktuSelesai)
        try container.encode(dosen, forKey: .dosen)
        try container.encode(ruang, forKey: .ruang)
        try container.encode(lokasi ?? ruang, forKey: .lokasi)
        try container.encode(sks, forKey: .sks)
        try container.encode(kategori, forKey: .kategori)
        try container.encode(needsReview, forKey: .needsReview)
        try container.encode(confidence, forKey: .confidence)
        try container.encode(recognitionStatus, forKey: .recognitionStatus)
        try container.encode(fieldConfidence, forKey: .fieldConfidence)
        try container.encode(reviewReasons, forKey: .reviewReasons)
        try container.encode(rawFields, forKey: .rawFields)
    }
}

/// Struktur data respon pratinjau impor jadwal dari backend TrackerThings
public struct ScheduleImportPreviewResponse: Codable, Sendable {
    public let items: [ImportScheduleItem]
    public let total: Int
    public let requiresReview: Bool
    public let layout: String?
    public let insufficientForProduction: Bool
    public let insufficiencyReasons: [String]?
    public let visionFallbackEligible: Bool
    public let filename: String?
    public let engineUsed: String?
    public let processingStage: String?
    public let qualityStatus: String?
    public let warnings: [String]?
    public let draftId: String?
    public let draftVersion: Int?

    enum CodingKeys: String, CodingKey {
        case items
        case total
        case requiresReview = "requires_review"
        case layout
        case insufficientForProduction = "insufficient_for_production"
        case insufficiencyReasons = "insufficiency_reasons"
        case visionFallbackEligible = "vision_fallback_eligible"
        case visionFallbackEligibleCamel = "visionFallbackEligible"
        case filename
        case engineUsed = "engineUsed"
        case engineUsedSnake = "engine_used"
        case processingStage = "processingStage"
        case processingStageSnake = "processing_stage"
        case qualityStatus = "qualityStatus"
        case qualityStatusSnake = "quality_status"
        case warnings
        case draftId = "draft_id"
        case draftIdCamel = "draftId"
        case draftVersion = "draft_version"
        case draftVersionCamel = "draftVersion"
    }

    public init(
        items: [ImportScheduleItem] = [],
        total: Int = 0,
        requiresReview: Bool = false,
        layout: String? = nil,
        insufficientForProduction: Bool = false,
        insufficiencyReasons: [String]? = nil,
        visionFallbackEligible: Bool = false,
        filename: String? = nil,
        engineUsed: String? = nil,
        processingStage: String? = nil,
        qualityStatus: String? = nil,
        warnings: [String]? = nil,
        draftId: String? = nil,
        draftVersion: Int? = nil
    ) {
        self.items = items
        self.total = total
        self.requiresReview = requiresReview
        self.layout = layout
        self.insufficientForProduction = insufficientForProduction
        self.insufficiencyReasons = insufficiencyReasons
        self.visionFallbackEligible = visionFallbackEligible
        self.filename = filename
        self.engineUsed = engineUsed
        self.processingStage = processingStage
        self.qualityStatus = qualityStatus
        self.warnings = warnings
        self.draftId = draftId
        self.draftVersion = draftVersion
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.items = (try? container.decode([ImportScheduleItem].self, forKey: .items)) ?? []
        self.total = (try? container.decode(Int.self, forKey: .total)) ?? self.items.count
        self.requiresReview = (try? container.decode(Bool.self, forKey: .requiresReview)) ?? false
        self.layout = try? container.decode(String.self, forKey: .layout)
        self.insufficientForProduction = (try? container.decode(Bool.self, forKey: .insufficientForProduction)) ?? false
        self.insufficiencyReasons = try? container.decode([String].self, forKey: .insufficiencyReasons)
        self.visionFallbackEligible = (try? container.decode(Bool.self, forKey: .visionFallbackEligible))
            ?? (try? container.decode(Bool.self, forKey: .visionFallbackEligibleCamel))
            ?? false
        self.filename = try? container.decode(String.self, forKey: .filename)
        self.engineUsed = (try? container.decode(String.self, forKey: .engineUsed))
            ?? (try? container.decode(String.self, forKey: .engineUsedSnake))
        self.processingStage = (try? container.decode(String.self, forKey: .processingStage))
            ?? (try? container.decode(String.self, forKey: .processingStageSnake))
        self.qualityStatus = (try? container.decode(String.self, forKey: .qualityStatus))
            ?? (try? container.decode(String.self, forKey: .qualityStatusSnake))
        self.warnings = try? container.decode([String].self, forKey: .warnings)
        self.draftId = (try? container.decode(String.self, forKey: .draftId))
            ?? (try? container.decode(String.self, forKey: .draftIdCamel))
        self.draftVersion = (try? container.decode(Int.self, forKey: .draftVersion))
            ?? (try? container.decode(Int.self, forKey: .draftVersionCamel))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(items, forKey: .items)
        try container.encode(total, forKey: .total)
        try container.encode(requiresReview, forKey: .requiresReview)
        try container.encode(layout, forKey: .layout)
        try container.encode(insufficientForProduction, forKey: .insufficientForProduction)
        try container.encode(insufficiencyReasons, forKey: .insufficiencyReasons)
        try container.encode(visionFallbackEligible, forKey: .visionFallbackEligible)
        try container.encode(filename, forKey: .filename)
        try container.encode(engineUsed, forKey: .engineUsed)
        try container.encode(processingStage, forKey: .processingStage)
        try container.encode(qualityStatus, forKey: .qualityStatus)
        try container.encode(warnings, forKey: .warnings)
        try container.encodeIfPresent(draftId, forKey: .draftId)
        try container.encodeIfPresent(draftVersion, forKey: .draftVersion)
    }
}

/// Struktur respon saat batch jadwal impor dikonfirmasi dan disimpan ke database
public struct ScheduleImportConfirmResponse: Codable, Sendable {
    public let count: Int
    public let items: [JadwalItem]?
    public let learnedMappingsTotal: Int?

    enum CodingKeys: String, CodingKey {
        case count
        case items
        case learnedMappingsTotal = "learned_mappings_total"
    }
}

// MARK: - Spatial OCR Evidence Models

/// Koordinat bounding box ternormalisasi (0.0 ... 1.0) dengan titik asal kiri-atas (top-left)
public struct OcrBoundingBox: Codable, Sendable, Hashable {
    public let x0: Double
    public let y0: Double
    public let x1: Double
    public let y1: Double

    public init(x0: Double, y0: Double, x1: Double, y1: Double) {
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1
    }
}

/// Token kata individual hasil ekstraksi OCR beserta confidence dan lokasi spasial
public struct OcrWord: Codable, Sendable, Hashable {
    public let text: String
    public let confidence: Double
    public let bbox: OcrBoundingBox

    public init(text: String, confidence: Double, bbox: OcrBoundingBox) {
        self.text = text
        self.confidence = confidence
        self.bbox = bbox
    }
}

// MARK: - Offline Draft Persistence Models

public enum ScheduleDraftStatus: String, Codable, Sendable {
    case draft = "draft"
    case pendingSync = "pending_sync"
    case syncFailed = "sync_failed"
    case synced = "synced"
}

/// Enum engine yang sedang aktif memproses dokumen jadwal
public enum ScheduleImportEngine: String, CaseIterable, Codable, Sendable {
    case localAppleVision = "apple_vision"
    case typescript = "typescript"
    case python = "python"
    case serverInternet = "server"
    case react = "react"

    public var statusMessage: String {
        switch self {
        case .localAppleVision:
            return "Membaca teks dan menyusun jadwalmu di perangkat…"
        case .typescript:
            return "Sistem TrackerThings sedang memproses jadwalmu…"
        case .python:
            return "Mengompilasi dan mempertajam hasil analisismu…"
        case .serverInternet:
            return "Kami sedang memproses pertajaman analisismu, tunggu sebentar."
        case .react:
            return "Menyiapkan pratinjau antarmuka jadwal…"
        }
    }

    public var subMessage: String {
        switch self {
        case .localAppleVision:
            return "Ekstraksi OCR cepat & privat langsung di perangkat."
        case .typescript:
            return "Mengekstrak struktur tabel dan kolom jadwal kuliah..."
        case .python:
            return "Model Python sedang menyempurnakan pembacaan baris & sel..."
        case .serverInternet:
            return "Menghubungi layanan analisis cerdas TrackerThings..."
        case .react:
            return "Menyusun tampilan data interaktif TrackerThings..."
        }
    }

    public var assetBaseName: String {
        switch self {
        case .localAppleVision, .typescript:
            return "trackerthings_loading_typescript"
        case .python:
            return "trackerthings_loading_python"
        case .serverInternet:
            return "trackerthings_loading_internet"
        case .react:
            return "trackerthings_loading_react"
        }
    }
}

/// Draf jadwal hasil impor offline yang tersimpan secara lokal dan siap disinkronkan ke server
public struct OfflineScheduleDraft: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let fileName: String
    public let createdAt: Date
    public var updatedAt: Date
    public var items: [ImportScheduleItem]
    public var status: ScheduleDraftStatus
    public var syncErrorMessage: String?

    public init(
        id: String = UUID().uuidString,
        fileName: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        items: [ImportScheduleItem],
        status: ScheduleDraftStatus = .pendingSync,
        syncErrorMessage: String? = nil
    ) {
        self.id = id
        self.fileName = fileName
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.items = items
        self.status = status
        self.syncErrorMessage = syncErrorMessage
    }
}
