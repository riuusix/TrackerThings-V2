import Foundation

public struct LoginResponse: Codable, Sendable {
    public let success: Bool
    public let user: UserProfile?
    public let token: String?
    public let error: String?
}

public struct BaseResponse: Codable, Sendable {
    public let success: Bool
    public let message: String?
    public let error: String?
}

public protocol AuthServiceProtocol: Sendable {
    func login(username: String, password: String) async throws -> UserProfile
    func register(username: String, email: String, password: String, fullName: String?, phoneNumber: String?) async throws -> BaseResponse
    func getProfile() async throws -> UserProfile
    func updateProfile(fullName: String?, email: String, phoneNumber: String?, profilePictureUrl: String?) async throws -> BaseResponse
    func updatePassword(currentPassword: String, newPassword: String) async throws -> BaseResponse
    func updateSecurityPrompt(prompt: String, answer: String, currentPassword: String) async throws -> BaseResponse
}

public actor AuthService: AuthServiceProtocol {
    private let network: NetworkService

    public init(network: NetworkService = .shared) {
        self.network = network
    }

    public func login(username: String, password: String) async throws -> UserProfile {
        let payload = ["username": username, "password": password]
        let data = try JSONSerialization.data(withJSONObject: payload)

        let resp: LoginResponse = try await network.request(
            endpoint: "auth/login",
            method: "POST",
            body: data
        )

        guard resp.success, let user = resp.user else {
            throw NetworkError.serverError(statusCode: 400, message: resp.error ?? "Login gagal.")
        }

        if let token = resp.token {
            await network.setAuthToken(token)
        }

        return user
    }

    public func register(
        username: String,
        email: String,
        password: String,
        fullName: String? = nil,
        phoneNumber: String? = nil
    ) async throws -> BaseResponse {
        var payload: [String: Any] = [
            "username": username,
            "email": email,
            "password": password
        ]
        if let fullName = fullName { payload["full_name"] = fullName }
        if let phoneNumber = phoneNumber { payload["phone_number"] = phoneNumber }

        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "auth/register", method: "POST", body: data)
    }

    public func getProfile() async throws -> UserProfile {
        return try await network.request(endpoint: "profile", method: "GET")
    }

    public func updateProfile(
        fullName: String?,
        email: String,
        phoneNumber: String?,
        profilePictureUrl: String?
    ) async throws -> BaseResponse {
        var payload: [String: Any] = ["email": email]
        if let fullName = fullName { payload["full_name"] = fullName }
        if let phoneNumber = phoneNumber { payload["phone_number"] = phoneNumber }
        if let profilePictureUrl = profilePictureUrl { payload["profile_picture_url"] = profilePictureUrl }

        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "profile", method: "PUT", body: data)
    }

    public func updatePassword(currentPassword: String, newPassword: String) async throws -> BaseResponse {
        let payload = ["current_password": currentPassword, "new_password": newPassword]
        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "auth/update-password", method: "POST", body: data)
    }

    public func updateSecurityPrompt(prompt: String, answer: String, currentPassword: String) async throws -> BaseResponse {
        let payload = [
            "security_prompt": prompt,
            "security_answer": answer,
            "current_password": currentPassword
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "auth/security-prompt", method: "POST", body: data)
    }
}

