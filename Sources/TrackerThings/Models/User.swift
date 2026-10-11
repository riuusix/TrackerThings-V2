import Foundation

public struct UserSession: Codable, Sendable, Identifiable {
    public var id: Int { userId }
    public let userId: Int
    public let username: stringOrEmpty
    public let email: String
    public let role: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case username
        case email
        case role
    }
}

public typealias stringOrEmpty = String

public struct UserProfile: Codable, Sendable, Identifiable {
    public let id: Int
    public var username: String
    public var email: String
    public var fullName: String?
    public var phoneNumber: String?
    public var profilePictureUrl: String?
    public var securityPrompt: String?
    public var createdAt: Date?
    public var profileUpdatedAt: Date?
    public var passwordChangedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case email
        case fullName = "full_name"
        case phoneNumber = "phone_number"
        case profilePictureUrl = "profile_picture_url"
        case securityPrompt = "security_prompt"
        case createdAt = "created_at"
        case profileUpdatedAt = "profile_updated_at"
        case passwordChangedAt = "password_changed_at"
    }

    public init(
        id: Int,
        username: String,
        email: String,
        fullName: String? = nil,
        phoneNumber: String? = nil,
        profilePictureUrl: String? = nil,
        securityPrompt: String? = nil,
        createdAt: Date? = nil,
        profileUpdatedAt: Date? = nil,
        passwordChangedAt: Date? = nil
    ) {
        self.id = id
        self.username = username
        self.email = email
        self.fullName = fullName
        self.phoneNumber = phoneNumber
        self.profilePictureUrl = profilePictureUrl
        self.securityPrompt = securityPrompt
        self.createdAt = createdAt
        self.profileUpdatedAt = profileUpdatedAt
        self.passwordChangedAt = passwordChangedAt
    }
}

