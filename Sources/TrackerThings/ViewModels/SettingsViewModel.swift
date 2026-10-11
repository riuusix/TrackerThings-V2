import Foundation
import SwiftUI

public enum SettingsAlert: Identifiable {
    case error(String)
    case success(String)

    public var id: String {
        switch self {
        case .error(let msg): return "err-\(msg)"
        case .success(let msg): return "succ-\(msg)"
        }
    }
}

/// ViewModel untuk manajemen pengaturan profil dan keamanan akun.
/// Didesain sesuai standar modern Swift 6 (@Observable & @MainActor).
@Observable
@MainActor
public final class SettingsViewModel {
    // MARK: - Form Inputs
    public var fullName: String = ""
    public var phoneNumber: String = ""

    public var currentPassword: String = ""
    public var newPassword: String = ""
    public var confirmPassword: String = ""

    // MARK: - Visibility Toggles
    public var isCurrentPasswordVisible: Bool = false
    public var isNewPasswordVisible: Bool = false
    public var isConfirmPasswordVisible: Bool = false

    // MARK: - UI States
    public var isLoadingProfile: Bool = false
    public var isLoadingPassword: Bool = false
    public var errorMessage: String? = nil
    public var successMessage: String? = nil
    public var activeAlert: SettingsAlert? = nil

    private let authService: AuthServiceProtocol

    public init(authService: AuthServiceProtocol = AuthService()) {
        self.authService = authService
    }

    public func loadUserData(from user: UserProfile?) {
        if let user = user {
            self.fullName = user.fullName ?? ""
            self.phoneNumber = user.phoneNumber ?? ""
        }
    }

    // MARK: - Validasi Inline
    public var isNameValid: Bool {
        !fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public var passwordValidationMessage: String? {
        if currentPassword.isEmpty && newPassword.isEmpty && confirmPassword.isEmpty {
            return nil
        }
        if currentPassword.isEmpty {
            return "Kata sandi lama wajib diisi."
        }
        if newPassword.isEmpty {
            return "Kata sandi baru wajib diisi."
        }
        if newPassword.count < 6 {
            return "Kata sandi baru minimal 6 karakter."
        }
        if !confirmPassword.isEmpty && newPassword != confirmPassword {
            return "Konfirmasi kata sandi tidak cocok."
        }
        if !currentPassword.isEmpty && !newPassword.isEmpty && currentPassword == newPassword {
            return "Kata sandi baru tidak boleh sama dengan kata sandi lama."
        }
        return nil
    }

    public var isPasswordFormValid: Bool {
        !currentPassword.isEmpty &&
        newPassword.count >= 6 &&
        newPassword == confirmPassword &&
        currentPassword != newPassword
    }

    // MARK: - API Actions

    /// Memperbarui informasi profil pengguna (Nama Lengkap & Nomor HP)
    public func saveProfile() async -> UserProfile? {
        guard isNameValid else {
            let msg = "Nama lengkap tidak boleh kosong."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }

        isLoadingProfile = true
        errorMessage = nil
        successMessage = nil

        do {
            let updated = try await authService.updateUserSettings(
                fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines),
                phoneNumber: phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            isLoadingProfile = false
            let successMsg = "Profil berhasil diperbarui!"
            self.successMessage = successMsg
            self.activeAlert = .success(successMsg)
            return updated
        } catch let err as AppError {
            isLoadingProfile = false
            let msg = err.errorDescription ?? "Gagal memperbarui profil."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        } catch {
            isLoadingProfile = false
            let msg = error.localizedDescription
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }
    }

    /// Memperbarui kata sandi pengguna
    public func savePassword() async -> Bool {
        if let validationErr = passwordValidationMessage {
            self.errorMessage = validationErr
            self.activeAlert = .error(validationErr)
            return false
        }

        isLoadingPassword = true
        errorMessage = nil
        successMessage = nil

        do {
            let resp = try await authService.changeUserPassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            )
            isLoadingPassword = false

            // Reset field password setelah sukses
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""

            let msg = resp.message ?? "Kata sandi berhasil diperbarui!"
            self.successMessage = msg
            self.activeAlert = .success(msg)
            return true
        } catch let err as AppError {
            isLoadingPassword = false
            let msg = err.errorDescription ?? "Gagal memperbarui kata sandi."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return false
        } catch {
            isLoadingPassword = false
            let msg = error.localizedDescription
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return false
        }
    }

    public func clearMessages() {
        errorMessage = nil
        successMessage = nil
        activeAlert = nil
    }
}

