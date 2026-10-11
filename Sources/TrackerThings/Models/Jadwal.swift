import Foundation

public struct JadwalItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let userId: Int?
    public var namaMatkul: String
    public var dosen: String?
    public var kategori: String?
    public var lokasi: String?
    public var hari: String
    public var waktuMulai: String
    public var waktuSelesai: String
    public var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case namaMatkul = "nama_matkul"
        case dosen
        case kategori
        case lokasi
        case hari
        case waktuMulai = "waktu_mulai"
        case waktuSelesai = "waktu_selesai"
        case createdAt = "created_at"
    }

    public init(
        id: Int,
        userId: Int? = nil,
        namaMatkul: String,
        dosen: String? = nil,
        kategori: String? = nil,
        lokasi: String? = nil,
        hari: String,
        waktuMulai: String,
        waktuSelesai: String,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.userId = userId
        self.namaMatkul = namaMatkul
        self.dosen = dosen
        self.kategori = kategori
        self.lokasi = lokasi
        self.hari = hari
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.createdAt = createdAt
    }
}

public struct JadwalGabunganItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let idJadwal: Int?
    public let namaMatkul: String
    public let dosen: String?
    public let kategori: String?
    public let lokasi: String?
    public let waktuMulai: String
    public let waktuSelesai: String
    public let tipe: TipeJadwal
    public let catatan: String?
    public let status: String?

    public enum TipeJadwal: String, Codable, Sendable {
        case reguler
        case pengganti
    }

    public init(
        id: Int,
        idJadwal: Int? = nil,
        namaMatkul: String,
        dosen: String? = nil,
        kategori: String? = nil,
        lokasi: String? = nil,
        waktuMulai: String,
        waktuSelesai: String,
        tipe: TipeJadwal,
        catatan: String? = nil,
        status: String? = nil
    ) {
        self.id = id
        self.idJadwal = idJadwal
        self.namaMatkul = namaMatkul
        self.dosen = dosen
        self.kategori = kategori
        self.lokasi = lokasi
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.tipe = tipe
        self.catatan = catatan
        self.status = status
    }
}

