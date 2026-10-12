import Foundation

public struct UjianItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let userId: Int?
    public var idJadwal: Int
    public var jenisUjian: String
    public var tanggal: Date
    public var waktuMulai: String?
    public var waktuSelesai: String?
    public var ruangan: String?
    public var catatan: String?
    public var createdAt: Date?
    public var jadwal: CourseInfo?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case idJadwal = "id_jadwal"
        case jenisUjian = "jenis_ujian"
        case tanggal
        case waktuMulai = "waktu_mulai"
        case waktuSelesai = "waktu_selesai"
        case ruangan
        case catatan
        case createdAt = "created_at"
        case jadwal
    }

    public init(
        id: Int,
        userId: Int? = nil,
        idJadwal: Int,
        jenisUjian: String,
        tanggal: Date,
        waktuMulai: String? = nil,
        waktuSelesai: String? = nil,
        ruangan: String? = nil,
        catatan: String? = nil,
        createdAt: Date? = nil,
        jadwal: CourseInfo? = nil
    ) {
        self.id = id
        self.userId = userId
        self.idJadwal = idJadwal
        self.jenisUjian = jenisUjian
        self.tanggal = tanggal
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.ruangan = ruangan
        self.catatan = catatan
        self.createdAt = createdAt
        self.jadwal = jadwal
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(Int.self, forKey: .id)
        self.userId = try container.decodeIfPresent(Int.self, forKey: .userId)
        self.idJadwal = try container.decode(Int.self, forKey: .idJadwal)
        self.jenisUjian = try container.decode(String.self, forKey: .jenisUjian)

        // Tanggal ujian adalah tanggal kalender: parse via CalendarDateHelper agar tidak bergeser di zona waktu lokal
        if let str = try? container.decode(String.self, forKey: .tanggal) {
            self.tanggal = CalendarDateHelper.parseCalendarDate(str)
        } else if let date = try? container.decode(Date.self, forKey: .tanggal) {
            self.tanggal = date
        } else {
            self.tanggal = Date()
        }

        self.waktuMulai = try container.decodeIfPresent(String.self, forKey: .waktuMulai)
        self.waktuSelesai = try container.decodeIfPresent(String.self, forKey: .waktuSelesai)
        self.ruangan = try container.decodeIfPresent(String.self, forKey: .ruangan)
        self.catatan = try container.decodeIfPresent(String.self, forKey: .catatan)
        self.createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        self.jadwal = try container.decodeIfPresent(CourseInfo.self, forKey: .jadwal)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encode(idJadwal, forKey: .idJadwal)
        try container.encode(jenisUjian, forKey: .jenisUjian)

        // Tanggal dikirim sebagai tanggal kalender murni YYYY-MM-DD tanpa konversi UTC instant
        let dateStr = CalendarDateHelper.formatCalendarDate(tanggal)
        try container.encode(dateStr, forKey: .tanggal)

        try container.encodeIfPresent(waktuMulai, forKey: .waktuMulai)
        try container.encodeIfPresent(waktuSelesai, forKey: .waktuSelesai)
        try container.encodeIfPresent(ruangan, forKey: .ruangan)
        try container.encodeIfPresent(catatan, forKey: .catatan)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(jadwal, forKey: .jadwal)
    }
}
