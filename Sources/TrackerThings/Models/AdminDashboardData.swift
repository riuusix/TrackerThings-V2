import Foundation

/// Data model untuk metrik ringkasan admin panel
public struct AdminDashboardData: Codable, Sendable {
    public let totalUsers: Int
    public let totalTasks: Int
    public let totalCourses: Int
    public let totalExams: Int
    public let totalReplacements: Int
    public let serverTime: String?
    public let systemStatus: String?
    public let recentUsers: [AdminRecentUser]

    enum CodingKeys: String, CodingKey {
        case totalUsers = "totalUsers"
        case totalTasks = "totalTasks"
        case totalCourses = "totalCourses"
        case totalExams = "totalExams"
        case totalReplacements = "totalReplacements"
        case serverTime = "serverTime"
        case systemStatus = "systemStatus"
        case recentUsers = "recentUsers"
    }

    public init(
        totalUsers: Int = 0,
        totalTasks: Int = 0,
        totalCourses: Int = 0,
        totalExams: Int = 0,
        totalReplacements: Int = 0,
        serverTime: String? = nil,
        systemStatus: String? = "Healthy",
        recentUsers: [AdminRecentUser] = []
    ) {
        self.totalUsers = totalUsers
        self.totalTasks = totalTasks
        self.totalCourses = totalCourses
        self.totalExams = totalExams
        self.totalReplacements = totalReplacements
        self.serverTime = serverTime
        self.systemStatus = systemStatus
        self.recentUsers = recentUsers
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        self.totalUsers = try container.decodeIfPresent(Int.self, forKey: .totalUsers) ?? 0
        self.totalTasks = try container.decodeIfPresent(Int.self, forKey: .totalTasks) ?? 0
        self.totalCourses = try container.decodeIfPresent(Int.self, forKey: .totalCourses) ?? 0
        self.totalExams = try container.decodeIfPresent(Int.self, forKey: .totalExams) ?? 0
        self.totalReplacements = try container.decodeIfPresent(Int.self, forKey: .totalReplacements) ?? 0
        self.serverTime = try container.decodeIfPresent(String.self, forKey: .serverTime)
        self.systemStatus = try container.decodeIfPresent(String.self, forKey: .systemStatus) ?? "Healthy"
        self.recentUsers = try container.decodeIfPresent([AdminRecentUser].self, forKey: .recentUsers) ?? []
    }
}

/// Data model pengguna terbaru di dashboard admin
public struct AdminRecentUser: Codable, Sendable, Identifiable {
    public let id: Int
    public let username: String
    public let email: String
    public let fullName: String?
    public let role: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case fullName = "fullName"
        case role
        case createdAt = "createdAt"
    }

    public init(
        id: Int,
        username: String,
        email: String,
        fullName: String? = nil,
        role: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.username = username
        self.email = email
        self.fullName = fullName
        self.role = role
        self.createdAt = createdAt
    }
}

