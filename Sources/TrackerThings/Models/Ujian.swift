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
}

