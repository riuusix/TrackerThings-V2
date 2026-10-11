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
}

