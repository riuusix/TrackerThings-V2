import Foundation

public struct CourseInfo: Codable, Sendable, Hashable {
    public let namaMatkul: String

    enum CodingKeys: String, CodingKey {
        case namaMatkul = "nama_matkul"
    }

    public init(namaMatkul: String) {
        self.namaMatkul = namaMatkul
    }
}

public struct TugasItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let userId: Int?
    public var idJadwal: Int
    public var namaTugas: String
    public var deadline: Date
    public var prioritas: PrioritasTugas
    public var jenis: JenisTugas
    public var status: StatusTugas
    public var progress: Int
    public var createdAt: Date?
    public var jadwal: CourseInfo?

    public enum PrioritasTugas: String, Codable, Sendable, CaseIterable {
        case tinggi = "Tinggi"
        case sedang = "Sedang"
        case rendah = "Rendah"
    }

    public enum JenisTugas: String, Codable, Sendable, CaseIterable {
        case individu = "Individu"
        case kelompok = "Kelompok"
    }

    public enum StatusTugas: String, Codable, Sendable, CaseIterable {
        case belumDikerjakan = "Belum Dikerjakan"
        case sedangDikerjakan = "Sedang Dikerjakan"
        case selesai = "Selesai"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case idJadwal = "id_jadwal"
        case namaTugas = "nama_tugas"
        case deadline
        case prioritas
        case jenis
        case status
        case progress
        case createdAt = "created_at"
        case jadwal
    }

    public init(
        id: Int,
        userId: Int? = nil,
        idJadwal: Int,
        namaTugas: String,
        deadline: Date,
        prioritas: PrioritasTugas = .sedang,
        jenis: JenisTugas = .individu,
        status: StatusTugas = .belumDikerjakan,
        progress: Int = 0,
        createdAt: Date? = nil,
        jadwal: CourseInfo? = nil
    ) {
        self.id = id
        self.userId = userId
        self.idJadwal = idJadwal
        self.namaTugas = namaTugas
        self.deadline = deadline
        self.prioritas = prioritas
        self.jenis = jenis
        self.status = status
        self.progress = progress
        self.createdAt = createdAt
        self.jadwal = jadwal
    }
}

