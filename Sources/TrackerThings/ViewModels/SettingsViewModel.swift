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
    public var profilePictureUrl: String = ""

    public var currentPassword: String = ""
    public var newPassword: String = ""
    public var confirmPassword: String = ""

    // MARK: - Visibility Toggles
    public var isCurrentPasswordVisible: Bool = false
    public var isNewPasswordVisible: Bool = false
    public var isConfirmPasswordVisible: Bool = false

    // MARK: - UI States
    public var isLoadingProfile: Bool = false
    public var isUploadingAvatar: Bool = false
    public var isLoadingPassword: Bool = false
    public var errorMessage: String? = nil
    public var successMessage: String? = nil
    public var activeAlert: SettingsAlert? = nil

    // MARK: - Notification Preferences
    public var notificationPreferences: NotificationPreferences = NotificationPreferences.load()

    public func updateNotificationPreferences() {
        notificationPreferences.save()
    }

    public enum ServerConnectionStatus: Equatable, Sendable {
        case checking
        case connected(lastSync: Date?)
        case offline
        case serverUnavailable(statusCode: Int?, message: String)
        case authenticationRequired
        case timedOut
    }

    public var connectionStatus: ServerConnectionStatus = .checking
    public private(set) var lastCheckedAt: Date? = nil

    private var connectionCheckTask: Task<Void, Never>?
    private var currentCheckId: UUID = UUID()

    private let authService: AuthServiceProtocol

    public init(authService: AuthServiceProtocol = AuthService()) {
        self.authService = authService
    }

    public func checkServerConnection() async {
        // Batalkan tugas pengecekan sebelumnya agar tidak terjadi race condition
        connectionCheckTask?.cancel()

        let checkId = UUID()
        self.currentCheckId = checkId

        // Pengecekan offline langsung tanpa menunggu socket timeout
        if !NetworkMonitor.shared.isConnected {
            self.connectionStatus = .offline
            self.lastCheckedAt = Date()
            return
        }

        self.connectionStatus = .checking

        let task = Task { [weak self] () -> ServerConnectionStatus in
            guard let self = self else { return .serverUnavailable(statusCode: nil, message: "Layanan dilepas") }
            return await self.performConnectionCheckWithTimeout(timeoutSeconds: 6.0)
        }

        self.connectionCheckTask = Task { @MainActor [weak self] in
            let result = await task.value
            guard let self = self, self.currentCheckId == checkId, !Task.isCancelled else { return }
            self.connectionStatus = result
            self.lastCheckedAt = Date()
        }

        await self.connectionCheckTask?.value
    }

    private func performConnectionCheckWithTimeout(timeoutSeconds: TimeInterval) async -> ServerConnectionStatus {
        do {
            return try await withThrowingTaskGroup(of: ServerConnectionStatus.self) { group in
                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                    return .timedOut
                }

                group.addTask { [weak self] in
                    guard let self = self else { return .serverUnavailable(statusCode: nil, message: "Layanan dilepas") }
                    return await self.probeServerStatus()
                }

                if let first = try await group.next() {
                    group.cancelAll()
                    return first
                }
                return .serverUnavailable(statusCode: nil, message: "Koneksi tidak diketahui")
            }
        } catch {
            if Task.isCancelled {
                return self.connectionStatus
            }
            return .serverUnavailable(statusCode: nil, message: error.localizedDescription)
        }
    }

    private func probeServerStatus() async -> ServerConnectionStatus {
        do {
            _ = try await authService.checkServerHealth()
            let lastSync = LocalCacheService.shared.getLastSyncDate()
            return .connected(lastSync: lastSync)
        } catch {
            if case AppError.unauthorized = error {
                return .authenticationRequired
            }
            if case AppError.offline = error {
                return .offline
            }
            if case AppError.timeout = error {
                return .timedOut
            }
            if case let AppError.serverError(code, message) = error {
                if code == 401 {
                    return .authenticationRequired
                }
                return .serverUnavailable(statusCode: code, message: message)
            }
            if case let AppError.serverUnreachable(message) = error {
                return .serverUnavailable(statusCode: nil, message: message)
            }
            if case let AppError.networkConnection(message) = error {
                return .serverUnavailable(statusCode: nil, message: message)
            }
            if error is CancellationError {
                return self.connectionStatus
            }
            return .serverUnavailable(statusCode: nil, message: error.localizedDescription)
        }
    }

    public func loadUserData(from user: UserProfile?) {
        if let user = user {
            self.fullName = user.fullName ?? ""
            self.phoneNumber = user.phoneNumber ?? ""
            self.profilePictureUrl = user.profilePictureUrl ?? ""
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

    public var isOffline: Bool {
        !NetworkMonitor.shared.isConnected
    }

    /// Memperbarui informasi profil pengguna (Nama Lengkap & Nomor HP)
    public func saveProfile() async -> UserProfile? {
        guard !isLoadingProfile else { return nil }
        guard !isOffline else {
            let msg = "Tidak dapat memperbarui profil saat offline. Hubungkan ke internet terlebih dahulu."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }

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
            let cleanName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
            let cleanPhone = phoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            let cleanPic = profilePictureUrl.trimmingCharacters(in: .whitespacesAndNewlines)

            let updated = try await authService.updateUserSettings(
                fullName: cleanName,
                phoneNumber: cleanPhone.isEmpty ? nil : cleanPhone,
                profilePictureUrl: cleanPic.isEmpty ? nil : cleanPic
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

    /// Mengunggah file avatar biner langsung ke endpoint server (maks 2MB)
    public func uploadAvatar(data: Data, mimeType: String = "image/jpeg", fileName: String = "avatar.jpg") async -> UserProfile? {
        guard !isUploadingAvatar else { return nil }
        guard !isOffline else {
            let msg = "Tidak dapat mengunggah foto profil saat offline. Hubungkan ke internet terlebih dahulu."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }

        guard data.count <= 2 * 1024 * 1024 else {
            let msg = "Ukuran gambar melebihi batas maksimal 2 MB."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }

        isUploadingAvatar = true
        errorMessage = nil
        successMessage = nil

        do {
            let updated = try await authService.uploadAvatar(data: data, mimeType: mimeType, fileName: fileName)
            isUploadingAvatar = false
            self.profilePictureUrl = updated.profilePictureUrl ?? ""
            let successMsg = "Foto profil berhasil diperbarui!"
            self.successMessage = successMsg
            self.activeAlert = .success(successMsg)
            return updated
        } catch let err as AppError {
            isUploadingAvatar = false
            let msg = err.errorDescription ?? "Gagal mengunggah foto profil."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        } catch {
            isUploadingAvatar = false
            let msg = error.localizedDescription
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return nil
        }
    }

    /// Memperbarui kata sandi pengguna
    public func savePassword() async -> Bool {
        guard !isLoadingPassword else { return false }
        guard !isOffline else {
            let msg = "Tidak dapat mengubah kata sandi saat offline. Hubungkan ke internet terlebih dahulu."
            self.errorMessage = msg
            self.activeAlert = .error(msg)
            return false
        }

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

