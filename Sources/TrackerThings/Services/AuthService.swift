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
    func restoreSession() async throws -> UserProfile?
    func logout() async
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
            KeychainHelper.shared.saveToken(token)
        }

        return user
    }

    public func restoreSession() async throws -> UserProfile? {
        guard let token = KeychainHelper.shared.getToken(), !token.isEmpty else {
            return nil
        }

        // Periksa apakah token kedaluwarsa
        if JWTTokenHelper.isExpired(token: token) {
            KeychainHelper.shared.deleteToken()
            await network.setAuthToken(nil)
            return nil
        }

        await network.setAuthToken(token)

        // Buat UserProfile dari payload JWT yang valid
        if let payload = JWTTokenHelper.decode(token: token),
           let userId = payload.userId,
           let username = payload.username,
           let email = payload.email {
            return UserProfile(
                id: userId,
                username: username,
                email: email
            )
        }

        return nil
    }

    public func logout() async {
        KeychainHelper.shared.deleteToken()
        await network.setAuthToken(nil)
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

public struct JWTPayload: Codable, Sendable {
    public let userId: Int?
    public let username: String?
    public let email: String?
    public let role: String?
    public let exp: TimeInterval?

    enum CodingKeys: String, CodingKey {
        case userId
        case username
        case email
        case role
        case exp
    }
}

public enum JWTTokenHelper {
    public static func decode(token: String) -> JWTPayload? {
        let parts = token.components(separatedBy: ".")
        guard parts.count == 3 else { return nil }
        var base64 = parts[1]
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 {
            base64.append("=")
        }
        guard let data = Data(base64Encoded: base64) else { return nil }
        return try? JSONDecoder().decode(JWTPayload.self, from: data)
    }

    public static func isExpired(token: String) -> Bool {
        guard let payload = decode(token: token), let exp = payload.exp else {
            return true
        }
        return Date().timeIntervalSince1970 >= exp
    }
}

