import Foundation

public struct NotificationItem: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let judul: String
    public let namaMatkul: String
    public let waktu: String
    public let tipe: TipeNotifikasi
    public let isUrgent: Bool
    public let entityType: String?
    public let entityId: Int?
    public var isRead: Bool
    public let createdAt: Date

    public enum TipeNotifikasi: String, Codable, Sendable, CaseIterable {
        case tugas = "Tugas"
        case ujian = "Ujian"
        case kuliah = "Kuliah"
        case pengganti = "Kelas Pengganti"

        public var iconName: String {
            switch self {
            case .tugas: return "checklist"
            case .ujian: return "graduationcap.fill"
            case .kuliah: return "book.closed.fill"
            case .pengganti: return "calendar.badge.clock"
            }
        }
    }

    public init(
        id: String,
        judul: String,
        namaMatkul: String,
        waktu: String,
        tipe: TipeNotifikasi,
        isUrgent: Bool = false,
        entityType: String? = nil,
        entityId: Int? = nil,
        isRead: Bool = false,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.judul = judul
        self.namaMatkul = namaMatkul
        self.waktu = waktu
        self.tipe = tipe
        self.isUrgent = isUrgent
        self.entityType = entityType
        self.entityId = entityId
        self.isRead = isRead
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id, judul, namaMatkul, waktu, tipe, isUrgent, entityType, entityId, isRead, createdAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(String.self, forKey: .id)
        self.judul = try container.decode(String.self, forKey: .judul)
        self.namaMatkul = try container.decode(String.self, forKey: .namaMatkul)
        self.waktu = try container.decode(String.self, forKey: .waktu)
        self.tipe = (try? container.decode(TipeNotifikasi.self, forKey: .tipe)) ?? .tugas
        self.isUrgent = try container.decodeIfPresent(Bool.self, forKey: .isUrgent) ?? false
        self.entityType = try container.decodeIfPresent(String.self, forKey: .entityType)
        self.entityId = try container.decodeIfPresent(Int.self, forKey: .entityId)
        self.isRead = try container.decodeIfPresent(Bool.self, forKey: .isRead) ?? false
        self.createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
    }

    /// Menghasilkan rute navigasi bertipe (`AppRoute`) berdasarkan `entityType`/`entityId` atau pola `id`.
    public var route: AppRoute? {
        if let type = entityType, let eid = entityId, eid > 0 {
            let payload = NotificationPayload(entityType: type, entityId: eid)
            return payload.route
        }
        // Fallback inferensi dari format id seperti "task-12", "exam-5", "course-3", "replacement-8"
        let parts = id.split(separator: "-")
        if parts.count >= 2, let parsedId = Int(parts.last ?? "") , parsedId > 0 {
            let prefix = String(parts[0]).lowercased()
            switch prefix {
            case "task", "tugas": return .taskDetail(id: parsedId)
            case "exam", "ujian": return .examDetail(id: parsedId)
            case "course", "jadwal": return .courseDetail(id: parsedId)
            case "replacement", "kp": return .replacementClassDetail(id: parsedId)
            default: break
            }
        }
        return nil
    }
}
