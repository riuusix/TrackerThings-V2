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
        hari: String = "Senin",
        waktuMulai: String = "08:00",
        waktuSelesai: String = "10:00",
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
        self.needsReview = needsReview
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

        // Hari
        self.hari = (try? container.decode(String.self, forKey: .hari)) ?? "Senin"

        // Waktu
        self.waktuMulai = (try? container.decode(String.self, forKey: .waktuMulai))
            ?? (try? container.decode(String.self, forKey: .waktuMulaiAlt))
            ?? "08:00"
        self.waktuSelesai = (try? container.decode(String.self, forKey: .waktuSelesai))
            ?? (try? container.decode(String.self, forKey: .waktuSelesaiAlt))
            ?? "10:00"

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
        self.needsReview = (try? container.decode(Bool.self, forKey: .needsReview))
            ?? (try? container.decode(Bool.self, forKey: .needsReviewAlt))
            ?? false

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

    enum CodingKeys: String, CodingKey {
        case items
        case total
        case requiresReview = "requires_review"
        case layout
        case insufficientForProduction = "insufficient_for_production"
        case insufficiencyReasons = "insufficiency_reasons"
        case visionFallbackEligible = "vision_fallback_eligible"
        case filename
    }

    public init(
        items: [ImportScheduleItem] = [],
        total: Int = 0,
        requiresReview: Bool = false,
        layout: String? = nil,
        insufficientForProduction: Bool = false,
        insufficiencyReasons: [String]? = nil,
        visionFallbackEligible: Bool = false,
        filename: String? = nil
    ) {
        self.items = items
        self.total = total
        self.requiresReview = requiresReview
        self.layout = layout
        self.insufficientForProduction = insufficientForProduction
        self.insufficiencyReasons = insufficiencyReasons
        self.visionFallbackEligible = visionFallbackEligible
        self.filename = filename
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.items = (try? container.decode([ImportScheduleItem].self, forKey: .items)) ?? []
        self.total = (try? container.decode(Int.self, forKey: .total)) ?? self.items.count
        self.requiresReview = (try? container.decode(Bool.self, forKey: .requiresReview)) ?? false
        self.layout = try? container.decode(String.self, forKey: .layout)
        self.insufficientForProduction = (try? container.decode(Bool.self, forKey: .insufficientForProduction)) ?? false
        self.insufficiencyReasons = try? container.decode([String].self, forKey: .insufficiencyReasons)
        self.visionFallbackEligible = (try? container.decode(Bool.self, forKey: .visionFallbackEligible)) ?? false
        self.filename = try? container.decode(String.self, forKey: .filename)
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

