import Foundation

public struct KelasPenggantiItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let userId: Int?
    public var idJadwal: Int
    public var tanggal: Date
    public var waktuMulai: String
    public var waktuSelesai: String
    public var lokasi: String?
    public var catatan: String?
    public var status: String
    public var createdAt: Date?
    public var jadwal: CourseCategoryInfo?

    public struct CourseCategoryInfo: Codable, Sendable, Hashable {
        public let namaMatkul: String
        public let kategori: String?

        enum CodingKeys: String, CodingKey {
            case namaMatkul = "nama_matkul"
            case kategori
        }

        public init(namaMatkul: String, kategori: String? = nil) {
            self.namaMatkul = namaMatkul
            self.kategori = kategori
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case idJadwal = "id_jadwal"
        case tanggal
        case waktuMulai = "waktu_mulai"
        case waktuSelesai = "waktu_selesai"
        case lokasi
        case catatan
        case status
        case createdAt = "created_at"
        case jadwal
    }

    public init(
        id: Int,
        userId: Int? = nil,
        idJadwal: Int,
        tanggal: Date,
        waktuMulai: String,
        waktuSelesai: String,
        lokasi: String? = nil,
        catatan: String? = nil,
        status: String = "Belum Selesai",
        createdAt: Date? = nil,
        jadwal: CourseCategoryInfo? = nil
    ) {
        self.id = id
        self.userId = userId
        self.idJadwal = idJadwal
        self.tanggal = tanggal
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.lokasi = lokasi
        self.catatan = catatan
        self.status = status
        self.createdAt = createdAt
        self.jadwal = jadwal
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(Int.self, forKey: .id)
        self.userId = try container.decodeIfPresent(Int.self, forKey: .userId)
        self.idJadwal = try container.decode(Int.self, forKey: .idJadwal)

        // Tanggal kelas pengganti adalah tanggal kalender: parse via CalendarDateHelper agar tidak bergeser di zona waktu lokal
        if let str = try? container.decode(String.self, forKey: .tanggal) {
            self.tanggal = CalendarDateHelper.parseCalendarDate(str)
        } else if let date = try? container.decode(Date.self, forKey: .tanggal) {
            self.tanggal = date
        } else {
            self.tanggal = Date()
        }

        self.waktuMulai = try container.decode(String.self, forKey: .waktuMulai)
        self.waktuSelesai = try container.decode(String.self, forKey: .waktuSelesai)
        self.lokasi = try container.decodeIfPresent(String.self, forKey: .lokasi)
        self.catatan = try container.decodeIfPresent(String.self, forKey: .catatan)
        self.status = (try? container.decode(String.self, forKey: .status)) ?? "Belum Selesai"
        self.createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        self.jadwal = try container.decodeIfPresent(CourseCategoryInfo.self, forKey: .jadwal)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encode(idJadwal, forKey: .idJadwal)

        // Tanggal dikirim sebagai tanggal kalender murni YYYY-MM-DD tanpa konversi UTC instant
        let dateStr = CalendarDateHelper.formatCalendarDate(tanggal)
        try container.encode(dateStr, forKey: .tanggal)

        try container.encode(waktuMulai, forKey: .waktuMulai)
        try container.encode(waktuSelesai, forKey: .waktuSelesai)
        try container.encodeIfPresent(lokasi, forKey: .lokasi)
        try container.encodeIfPresent(catatan, forKey: .catatan)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(jadwal, forKey: .jadwal)
    }
}
