import Foundation
import SwiftUI

@Observable
@MainActor
public final class AuthViewModel {
    public var currentUser: UserProfile?
    public var isAuthenticated: Bool = false
    public var isLoading: Bool = false
    public var isRestoringSession: Bool = true
    public var errorMessage: String?
    public var successMessage: String?

    private let authService: AuthServiceProtocol
    public init(authService: AuthServiceProtocol = AuthService()) {
        self.authService = authService
    }

    public func handleSessionExpired() {
        guard isAuthenticated else { return }
        currentUser = nil
        isAuthenticated = false
        errorMessage = "Sesi login telah berakhir. Silakan masuk kembali."
    }

    public func restoreSession() async {
        isRestoringSession = true
        defer { isRestoringSession = false }

        // Jika Keychain memiliki token yang belum expired, kita bisa memulihkan sesi lokal terlebih dahulu
        if let token = KeychainHelper.shared.getToken(),
           !token.isEmpty,
           !JWTTokenHelper.isExpired(token: token),
           let cachedUser: UserProfile = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile) {
            self.currentUser = cachedUser
            self.isAuthenticated = true
        }

        do {
            if let user = try await authService.restoreSession() {
                currentUser = user
                isAuthenticated = true
            } else {
                // Hanya batalkan autentikasi jika token benar-benar tidak ada atau telah expired/dihapus
                if KeychainHelper.shared.getToken() == nil {
                    currentUser = nil
                    isAuthenticated = false
                }
            }
        } catch {
            // Jangan membuang sesi jika ini hanya gangguan jaringan dan token masih ada di Keychain
            if let token = KeychainHelper.shared.getToken(), !JWTTokenHelper.isExpired(token: token) {
                if let cachedUser: UserProfile = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile) {
                    self.currentUser = cachedUser
                    self.isAuthenticated = true
                    return
                }
            }
            currentUser = nil
            isAuthenticated = false
        }
    }

    public func login(username: String, password: String) async {
        guard !isLoading else { return }
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty,
              !password.isEmpty else {
            errorMessage = "Username dan password wajib diisi."
            return
        }

        // Cek konektivitas jaringan sebelum login pertama kali
        if !NetworkMonitor.shared.isConnected {
            errorMessage = "Koneksi internet tidak tersedia. Login pertama kali memerlukan koneksi server aktif."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.login(username: username, password: password)
            currentUser = user
            isAuthenticated = true
            isLoading = false
        } catch let err as AppError {
            isLoading = false
            switch err {
            case .networkConnection, .invalidURL:
                errorMessage = "Gagal terhubung ke server. Periksa koneksi internet Anda lalu coba lagi."
            default:
                errorMessage = err.errorDescription ?? "Login gagal. Periksa username dan password Anda."
            }
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    public func register(
        username: String,
        email: String,
        password: String,
        fullName: String?,
        phoneNumber: String?
    ) async -> Bool {
        guard !isLoading else { return false }
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty,
              !email.trimmingCharacters(in: .whitespaces).isEmpty,
              password.count >= 6 else {
            errorMessage = "Lengkapi data dan gunakan password minimal 6 karakter."
            return false
        }

        isLoading = true
        errorMessage = nil

        do {
            let resp = try await authService.register(
                username: username,
                email: email,
                password: password,
                fullName: fullName,
                phoneNumber: phoneNumber
            )
            successMessage = resp.message ?? "Akun berhasil dibuat! Silakan login."
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
            return false
        }
    }

    public func logout() async {
        await authService.logout()
        currentUser = nil
        isAuthenticated = false
        errorMessage = nil
        successMessage = nil
    }

    public func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }
}

