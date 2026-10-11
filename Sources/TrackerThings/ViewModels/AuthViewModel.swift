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

    public func restoreSession() async {
        isRestoringSession = true
        defer { isRestoringSession = false }

        do {
            if let user = try await authService.restoreSession() {
                currentUser = user
                isAuthenticated = true
            } else {
                currentUser = nil
                isAuthenticated = false
            }
        } catch {
            currentUser = nil
            isAuthenticated = false
        }
    }

    public func login(username: String, password: String) async {
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty,
              !password.isEmpty else {
            errorMessage = "Username dan password wajib diisi."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let user = try await authService.login(username: username, password: password)
            currentUser = user
            isAuthenticated = true
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    public func register(
        username: String,
        email: String,
        password: String,
        fullName: String?,
        phoneNumber: String?
    ) async -> Bool {
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

