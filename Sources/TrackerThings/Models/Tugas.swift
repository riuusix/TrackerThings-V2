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
    public var isPinned: Bool
    public var reminderAt: Date?
    public var createdAt: Date?
    public var jadwal: CourseInfo?

    public enum PrioritasTugas: String, Codable, Sendable, CaseIterable {
        case tinggi = "Tinggi"
        case sedang = "Sedang"
        case rendah = "Rendah"

        public var sortWeight: Int {
            switch self {
            case .tinggi: return 0
            case .sedang: return 1
            case .rendah: return 2
            }
        }
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
        case isPinned = "is_pinned"
        case isPinnedCamel = "isPinned"
        case reminderAt = "reminder_at"
        case reminderAtCamel = "reminderAt"
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
        isPinned: Bool = false,
        reminderAt: Date? = nil,
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
        self.isPinned = isPinned
        self.reminderAt = reminderAt
        self.createdAt = createdAt
        self.jadwal = jadwal
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(Int.self, forKey: .id)
        self.userId = try container.decodeIfPresent(Int.self, forKey: .userId)
        self.idJadwal = try container.decode(Int.self, forKey: .idJadwal)
        self.namaTugas = try container.decode(String.self, forKey: .namaTugas)

        // Deadline adalah tanggal kalender: parse via CalendarDateHelper agar tidak bergeser di zona waktu lokal
        if let str = try? container.decode(String.self, forKey: .deadline) {
            self.deadline = CalendarDateHelper.parseCalendarDate(str)
        } else if let date = try? container.decode(Date.self, forKey: .deadline) {
            self.deadline = date
        } else {
            self.deadline = Date()
        }

        self.prioritas = try container.decode(PrioritasTugas.self, forKey: .prioritas)
        self.jenis = try container.decode(JenisTugas.self, forKey: .jenis)
        self.status = try container.decode(StatusTugas.self, forKey: .status)
        self.progress = try container.decode(Int.self, forKey: .progress)

        if let pinned = try? container.decodeIfPresent(Bool.self, forKey: .isPinned) {
            self.isPinned = pinned
        } else if let pinnedCamel = try? container.decodeIfPresent(Bool.self, forKey: .isPinnedCamel) {
            self.isPinned = pinnedCamel
        } else {
            self.isPinned = false
        }

        self.reminderAt = Self.decodeInstant(from: container, primaryKey: .reminderAt, secondaryKey: .reminderAtCamel)
        self.createdAt = try? container.decodeIfPresent(Date.self, forKey: .createdAt)
        self.jadwal = try container.decodeIfPresent(CourseInfo.self, forKey: .jadwal)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encode(idJadwal, forKey: .idJadwal)
        try container.encode(namaTugas, forKey: .namaTugas)

        // Deadline dikirim sebagai tanggal kalender murni YYYY-MM-DD tanpa konversi UTC instant
        let dateStr = CalendarDateHelper.formatCalendarDate(deadline)
        try container.encode(dateStr, forKey: .deadline)

        try container.encode(prioritas, forKey: .prioritas)
        try container.encode(jenis, forKey: .jenis)
        try container.encode(status, forKey: .status)
        try container.encode(progress, forKey: .progress)
        try container.encode(isPinned, forKey: .isPinned)
        if let reminderAt = reminderAt {
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try container.encode(iso.string(from: reminderAt), forKey: .reminderAt)
        }
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(jadwal, forKey: .jadwal)
    }

    private static func decodeInstant(
        from container: KeyedDecodingContainer<CodingKeys>,
        primaryKey: CodingKeys,
        secondaryKey: CodingKeys
    ) -> Date? {
        for key in [primaryKey, secondaryKey] {
            if let str = try? container.decodeIfPresent(String.self, forKey: key), !str.isEmpty {
                let isoFractional = ISO8601DateFormatter()
                isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let parsed = isoFractional.date(from: str) {
                    return parsed
                }
                let isoBasic = ISO8601DateFormatter()
                if let parsed = isoBasic.date(from: str) {
                    return parsed
                }
            }
            if let date = try? container.decodeIfPresent(Date.self, forKey: key) {
                return date
            }
        }
        return nil
    }
}
