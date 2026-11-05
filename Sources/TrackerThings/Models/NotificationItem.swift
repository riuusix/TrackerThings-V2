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
    public let eventKind: String // "academic", "reminder", "customReminder", "created"
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
        id: String? = nil,
        judul: String,
        namaMatkul: String,
        waktu: String,
        tipe: TipeNotifikasi,
        isUrgent: Bool = false,
        entityType: String? = nil,
        entityId: Int? = nil,
        eventKind: String = "academic",
        isRead: Bool = false,
        createdAt: Date = Date()
    ) {
        self.judul = judul
        self.namaMatkul = namaMatkul
        self.waktu = waktu
        self.tipe = tipe
        self.isUrgent = isUrgent
        self.entityType = entityType
        self.entityId = entityId
        self.eventKind = eventKind
        self.isRead = isRead
        self.createdAt = createdAt
        if let explicitId = id, !explicitId.isEmpty {
            self.id = Self.normalizeLegacyOrTimestampId(
                explicitId,
                kind: eventKind,
                entityType: entityType,
                entityId: entityId,
                fallbackTitle: judul
            )
        } else {
            self.id = Self.canonicalId(
                kind: eventKind,
                entityType: entityType,
                entityId: entityId,
                fallbackTitle: judul
            )
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, judul, namaMatkul, waktu, tipe, isUrgent, entityType, entityId, eventKind, isRead, createdAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawId = try container.decode(String.self, forKey: .id)
        let judul = try container.decode(String.self, forKey: .judul)
        let namaMatkul = try container.decode(String.self, forKey: .namaMatkul)
        let waktu = try container.decode(String.self, forKey: .waktu)
        let tipe = (try? container.decode(TipeNotifikasi.self, forKey: .tipe)) ?? .tugas
        let isUrgent = try container.decodeIfPresent(Bool.self, forKey: .isUrgent) ?? false
        let entityType = try container.decodeIfPresent(String.self, forKey: .entityType)
        let entityId = try container.decodeIfPresent(Int.self, forKey: .entityId)
        let eventKind = try container.decodeIfPresent(String.self, forKey: .eventKind) ?? "academic"
        let isRead = try container.decodeIfPresent(Bool.self, forKey: .isRead) ?? false
        let createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()

        self.id = Self.normalizeLegacyOrTimestampId(
            rawId,
            kind: eventKind,
            entityType: entityType,
            entityId: entityId,
            fallbackTitle: judul
        )
        self.judul = judul
        self.namaMatkul = namaMatkul
        self.waktu = waktu
        self.tipe = tipe
        self.isUrgent = isUrgent
        self.entityType = entityType
        self.entityId = entityId
        self.eventKind = eventKind
        self.isRead = isRead
        self.createdAt = createdAt
    }

    /// Menghasilkan identifier kanonik deterministik berdasarkan `kind`, `entityType`, dan `entityId`.
    /// Memastikan event yang sama (baik dari state akademik maupun notifikasi foreground) bersifat idempoten.
    public static func canonicalId(
        kind: String = "academic",
        entityType: String?,
        entityId: Int?,
        fallbackTitle: String? = nil
    ) -> String {
        let normalizedType = normalizeEntityPrefix(entityType)
        if let normalizedType, let eid = entityId, eid > 0 {
            switch kind {
            case "reminder":
                return "reminder-\(normalizedType)-\(eid)"
            case "customReminder":
                return "custom-reminder-\(normalizedType)-\(eid)"
            default:
                return "\(normalizedType)-\(eid)"
            }
        }
        let slug = (fallbackTitle ?? "item")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
        let prefix = normalizedType ?? "event"
        return "\(prefix)-\(slug)"
    }

    private static func normalizeEntityPrefix(_ entityType: String?) -> String? {
        guard let raw = entityType?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !raw.isEmpty else {
            return nil
        }
        switch raw {
        case "task", "tasks", "tugas":
            return "task"
        case "exam", "exams", "ujian":
            return "exam"
        case "course", "courses", "jadwal", "matkul":
            return "course"
        case "replacementclass", "replacement", "kp", "kelas-pengganti":
            return "replacement"
        default:
            return raw
        }
    }

    /// Menormalkan ID lama yang memakai timestamp (seperti `fg-task-12-176234...` atau `task-new-176234...`)
    /// menjadi ID kanonik deterministik.
    private static func normalizeLegacyOrTimestampId(
        _ rawId: String,
        kind: String,
        entityType: String?,
        entityId: Int?,
        fallbackTitle: String?
    ) -> String {
        if rawId.hasPrefix("fg-") || rawId.contains("-new-") {
            let inferredKind = rawId.hasPrefix("fg-") && kind == "academic" ? "reminder" : kind
            return canonicalId(
                kind: inferredKind,
                entityType: entityType,
                entityId: entityId,
                fallbackTitle: fallbackTitle
            )
        }
        return rawId
    }

    /// Menghasilkan rute navigasi bertipe (`AppRoute`) berdasarkan `entityType`/`entityId` atau pola `id`.
    public var route: AppRoute? {
        if let type = entityType, let eid = entityId, eid > 0 {
            let payload = NotificationPayload(entityType: type, entityId: eid)
            return payload.route
        }
        // Fallback inferensi dari format id seperti "task-12", "reminder-task-12", "exam-5", "course-3", "replacement-8"
        let parts = id.split(separator: "-")
        if parts.count >= 2, let parsedId = Int(parts.last ?? ""), parsedId > 0 {
            let prefixCandidates = parts.dropLast().map { String($0).lowercased() }
            if prefixCandidates.contains("task") || prefixCandidates.contains("tugas") {
                return .taskDetail(id: parsedId)
            }
            if prefixCandidates.contains("exam") || prefixCandidates.contains("ujian") {
                return .examDetail(id: parsedId)
            }
            if prefixCandidates.contains("course") || prefixCandidates.contains("jadwal") {
                return .courseDetail(id: parsedId)
            }
            if prefixCandidates.contains("replacement") || prefixCandidates.contains("kp") {
                return .replacementClassDetail(id: parsedId)
            }
        }
        return nil
    }
}
