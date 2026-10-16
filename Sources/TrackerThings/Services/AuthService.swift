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
    func updateUserSettings(fullName: String?, phoneNumber: String?, profilePictureUrl: String?) async throws -> UserProfile
    func changeUserPassword(currentPassword: String, newPassword: String, confirmPassword: String) async throws -> BaseResponse
    func uploadAvatar(data: Data, mimeType: String, fileName: String) async throws -> UserProfile
}

public extension AuthServiceProtocol {
    func updateUserSettings(fullName: String?, phoneNumber: String?) async throws -> UserProfile {
        try await updateUserSettings(fullName: fullName, phoneNumber: phoneNumber, profilePictureUrl: nil)
    }
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
            LocalCacheService.shared.save(user, forKey: LocalCacheService.keyUserProfile)
        }

        return user
    }

    public func restoreSession() async throws -> UserProfile? {
        guard let token = KeychainHelper.shared.getToken(), !token.isEmpty else {
            return nil
        }

        // Periksa apakah token kedaluwarsa secara lokal
        if JWTTokenHelper.isExpired(token: token) {
            KeychainHelper.shared.deleteToken()
            LocalCacheService.shared.remove(forKey: LocalCacheService.keyUserProfile)
            await network.setAuthToken(nil)
            return nil
        }

        await network.setAuthToken(token)

        // Coba sinkronisasi profil terbaru dari server (termasuk verifikasi role admin teraktual)
        do {
            let serverProfile: UserProfile = try await network.request(endpoint: "user/profile", method: "GET")
            // Simpan salinan profil resmi server ke cache lokal
            LocalCacheService.shared.save(serverProfile, forKey: LocalCacheService.keyUserProfile)
            return serverProfile
        } catch let err as AppError {
            // Jika ada AppError (respons HTTP dari server atau decoding payload server):
            // HTTP 401: Token ditolak/kedaluwarsa di server -> hapus sesi dan return nil
            switch err {
            case .unauthorized:
                KeychainHelper.shared.deleteToken()
                LocalCacheService.shared.remove(forKey: LocalCacheService.keyUserProfile)
                await network.setAuthToken(nil)
                return nil
            case .serverError(let code, _) where code == 401:
                KeychainHelper.shared.deleteToken()
                LocalCacheService.shared.remove(forKey: LocalCacheService.keyUserProfile)
                await network.setAuthToken(nil)
                return nil
            default:
                // Error server lain (403, 404, 500, decodingError, dll): request mencapai server namun gagal.
                // Jika server 5xx atau error selain 401, pertahankan profil lokal yang sah sebelumnya jika ada
                if let cached = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile) as UserProfile? {
                    return cached
                }
                return nil
            }
        } catch let urlErr as URLError {
            // Fallback HANYA untuk kegagalan transport/offline nyata saat perangkat tidak terhubung,
            // dan HANYA jika token belum kedaluwarsa secara lokal.
            let isOfflineOrTransportFailure: Bool
            switch urlErr.code {
            case .notConnectedToInternet,
                 .networkConnectionLost,
                 .timedOut,
                 .cannotConnectToHost,
                 .cannotFindHost,
                 .dnsLookupFailed,
                 .internationalRoamingOff,
                 .callIsActive,
                 .dataNotAllowed:
                isOfflineOrTransportFailure = true
            default:
                isOfflineOrTransportFailure = false
            }

            if isOfflineOrTransportFailure, !JWTTokenHelper.isExpired(token: token) {
                // 1. Prioritaskan data profil lengkap yang tersimpan di cache
                if let cachedProfile: UserProfile = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile) {
                    return cachedProfile
                }

                // 2. Fallback sekunder: decode JWT token payload lokal
                if let payload = JWTTokenHelper.decode(token: token),
                   let userId = payload.userId,
                   let username = payload.username,
                   let email = payload.email {
                    return UserProfile(
                        id: userId,
                        username: username,
                        email: email,
                        role: payload.role
                    )
                }
            }
            return nil
        } catch {
            // Error non-transport lainnya: periksa apakah ada cached profile sah jika token belum expired
            if !JWTTokenHelper.isExpired(token: token),
               let cached: UserProfile = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile) {
                return cached
            }
            return nil
        }
    }

    public func logout() async {
        KeychainHelper.shared.deleteToken()
        LocalCacheService.shared.clearAllCache()
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

    public func updateUserSettings(fullName: String?, phoneNumber: String?, profilePictureUrl: String? = nil) async throws -> UserProfile {
        var payload: [String: Any] = [:]
        if let fullName = fullName { payload["full_name"] = fullName }
        if let phoneNumber = phoneNumber { payload["phone_number"] = phoneNumber }
        if let profilePictureUrl = profilePictureUrl { payload["profile_picture_url"] = profilePictureUrl }
        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "user/profile", method: "PUT", body: data)
    }

    public func changeUserPassword(currentPassword: String, newPassword: String, confirmPassword: String) async throws -> BaseResponse {
        let payload = [
            "current_password": currentPassword,
            "new_password": newPassword,
            "confirm_password": confirmPassword,
        ]
        let data = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "user/password", method: "PUT", body: data)
    }

    public func uploadAvatar(data: Data, mimeType: String = "image/jpeg", fileName: String = "avatar.jpg") async throws -> UserProfile {
        let updatedUser: UserProfile = try await network.uploadMultipart(
            endpoint: "user/avatar",
            fileData: data,
            fileName: fileName,
            mimeType: mimeType,
            fieldName: "file"
        )
        LocalCacheService.shared.save(updatedUser, forKey: LocalCacheService.keyUserProfile)
        return updatedUser
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

