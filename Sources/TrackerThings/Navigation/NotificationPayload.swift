import Foundation

/// Skema payload terstruktur untuk notifikasi lokal UserNotifications dan Deep Linking.
/// Memastikan identifier stabil, versi skema eksplisit, dan kompatibilitas mundur dengan payload v1.
public struct NotificationPayload: Codable, Sendable, Equatable {
    public static let currentSchemaVersion: Int = 2

    public let schemaVersion: Int
    public let entityType: String // "task", "course", "exam", "replacementClass"
    public let entityId: Int
    public let kind: String // "reminder", "test", "tab"
    public let createdAt: Date?

    public init(
        schemaVersion: Int = NotificationPayload.currentSchemaVersion,
        entityType: String,
        entityId: Int,
        kind: String = "reminder",
        createdAt: Date? = Date()
    ) {
        self.schemaVersion = schemaVersion
        self.entityType = entityType
        self.entityId = entityId
        self.kind = kind
        self.createdAt = createdAt
    }

    /// Menghasilkan dictionary `userInfo` untuk dilampirkan ke `UNMutableNotificationContent`.
    /// Menyertakan field v2 terstruktur serta field legacy untuk kompatibilitas delegate lama.
    public var userInfo: [AnyHashable: Any] {
        var dict: [AnyHashable: Any] = [
            "v": schemaVersion,
            "entityType": entityType,
            "entityId": entityId,
            "kind": kind
        ]

        if let createdAt = createdAt {
            dict["createdAt"] = ISO8601DateFormatter().string(from: createdAt)
        }

        // Backward compatibility keys
        switch entityType {
        case "task":
            dict["destination"] = "tasks"
            dict["taskId"] = entityId
        case "course":
            dict["destination"] = "courses"
            dict["courseId"] = entityId
        case "exam":
            dict["destination"] = "exams"
            dict["examId"] = entityId
        case "replacementClass":
            dict["destination"] = "replacement"
            dict["replacementId"] = entityId
        default:
            dict["destination"] = "home"
        }

        return dict
    }

    /// Mengurai payload dari `userInfo` UNNotificationResponse secara aman dan toleran terhadap variasi tipe.
    public static func parse(from userInfo: [AnyHashable: Any]) -> NotificationPayload? {
        // 1. Skema modern v2
        if let type = userInfo["entityType"] as? String {
            let id = extractInt(from: userInfo["entityId"]) ?? 0
            let v = (userInfo["v"] as? Int) ?? currentSchemaVersion
            let kind = (userInfo["kind"] as? String) ?? "reminder"
            let createdAtStr = userInfo["createdAt"] as? String
            let date = createdAtStr.flatMap { ISO8601DateFormatter().date(from: $0) }
            return NotificationPayload(schemaVersion: v, entityType: type, entityId: id, kind: kind, createdAt: date)
        }

        // 2. Skema legacy v1 dengan key khusus entitas
        if let taskId = extractInt(from: userInfo["taskId"]) {
            return NotificationPayload(schemaVersion: 1, entityType: "task", entityId: taskId, kind: "reminder")
        }
        if let courseId = extractInt(from: userInfo["courseId"]) {
            return NotificationPayload(schemaVersion: 1, entityType: "course", entityId: courseId, kind: "reminder")
        }
        if let examId = extractInt(from: userInfo["examId"]) {
            return NotificationPayload(schemaVersion: 1, entityType: "exam", entityId: examId, kind: "reminder")
        }
        if let repId = extractInt(from: userInfo["replacementId"]) {
            return NotificationPayload(schemaVersion: 1, entityType: "replacementClass", entityId: repId, kind: "reminder")
        }

        // 3. Fallback jika hanya ada string `destination` (misal test notification)
        if let dest = userInfo["destination"] as? String {
            switch dest.lowercased() {
            case "tasks", "task":
                return NotificationPayload(schemaVersion: 1, entityType: "task", entityId: 0, kind: "tab")
            case "courses", "course", "matkul":
                return NotificationPayload(schemaVersion: 1, entityType: "course", entityId: 0, kind: "tab")
            case "exams", "exam", "ujian":
                return NotificationPayload(schemaVersion: 1, entityType: "exam", entityId: 0, kind: "tab")
            case "replacement", "kp", "kelaspengganti":
                return NotificationPayload(schemaVersion: 1, entityType: "replacementClass", entityId: 0, kind: "tab")
            case "settings", "setting", "pengaturan":
                return NotificationPayload(schemaVersion: 1, entityType: "settings", entityId: 0, kind: "tab")
            case "home", "dashboard":
                return NotificationPayload(schemaVersion: 1, entityType: "home", entityId: 0, kind: "tab")
            default:
                return nil
            }
        }

        return nil
    }

    /// Mengurai payload dari URL Deep Link (contoh: `trackerthings://task/12` atau `trackerthings://exam?id=5`)
    public static func parse(from url: URL) -> NotificationPayload? {
        guard url.scheme?.lowercased() == "trackerthings" else { return nil }

        let host = url.host?.lowercased() ?? ""
        let pathComponents = url.pathComponents.filter { $0 != "/" && !$0.isEmpty }

        // Format: trackerthings://task/123
        var type = host
        var idCandidate: Int? = nil

        if let first = pathComponents.first, let parsed = Int(first) {
            idCandidate = parsed
        } else if let second = pathComponents.dropFirst().first, let parsed = Int(second) {
            idCandidate = parsed
        }

        // Format query: trackerthings://task?id=123
        if idCandidate == nil, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            if let queryId = components.queryItems?.first(where: { $0.name.lowercased() == "id" })?.value {
                idCandidate = Int(queryId)
            }
        }

        // Normalisasi nama entitas
        let normalizedType: String
        switch type {
        case "task", "tasks", "tugas":
            normalizedType = "task"
        case "course", "courses", "matkul", "jadwal":
            normalizedType = "course"
        case "exam", "exams", "ujian":
            normalizedType = "exam"
        case "replacement", "replacementclass", "kp", "kelas-pengganti":
            normalizedType = "replacementClass"
        case "settings", "setting", "pengaturan":
            normalizedType = "settings"
        case "home", "dashboard":
            normalizedType = "home"
        default:
            normalizedType = type
        }

        return NotificationPayload(
            schemaVersion: currentSchemaVersion,
            entityType: normalizedType,
            entityId: idCandidate ?? 0,
            kind: idCandidate != nil ? "deeplink" : "tab"
        )
    }

    /// Mengonversi payload menjadi rute navigasi aplikasi bertipe.
    public var route: AppRoute? {
        guard entityId > 0 else { return nil }
        switch entityType {
        case "task":
            return .taskDetail(id: entityId)
        case "course":
            return .courseDetail(id: entityId)
        case "exam":
            return .examDetail(id: entityId)
        case "replacementClass":
            return .replacementClassDetail(id: entityId)
        default:
            return nil
        }
    }

    /// Tab tujuan yang bersangkutan dengan entitas ini.
    public var targetTab: AppTab {
        switch entityType {
        case "task":
            return .home
        case "course":
            return .courses
        case "exam":
            return .exams
        case "replacementClass":
            return .home
        case "settings":
            return .settings
        default:
            return .home
        }
    }

    private static func extractInt(from value: Any?) -> Int? {
        if let intVal = value as? Int { return intVal }
        if let strVal = value as? String { return Int(strVal) }
        if let numVal = value as? NSNumber { return numVal.intValue }
        return nil
    }
}
