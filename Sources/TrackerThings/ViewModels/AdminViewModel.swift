import Foundation
import SwiftUI

/// ViewModel untuk Admin Panel Dashboard (Swift 6 @Observable & @MainActor)
@Observable
@MainActor
public final class AdminViewModel {
    public var metrics: AdminDashboardData?
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isUnauthorized: Bool = false

    private let adminService: AdminServiceProtocol

    public init(adminService: AdminServiceProtocol = AdminService()) {
        self.adminService = adminService
    }

    /// Memuat data statistik dan metrik sistem admin dari backend
    public func loadDashboard() async {
        isLoading = true
        errorMessage = nil
        isUnauthorized = false

        do {
            let data = try await adminService.fetchDashboardMetrics()
            self.metrics = data
            self.isLoading = false
        } catch let appError as AppError {
            self.isLoading = false
            if case .serverError(let code, _) = appError, code == 403 {
                self.isUnauthorized = true
                self.errorMessage = "Akses ditolak: Anda tidak memiliki hak akses administrator."
            } else {
                self.errorMessage = appError.localizedDescription
            }
        } catch {
            self.isLoading = false
            self.errorMessage = error.localizedDescription
        }
    }

    public func clearError() {
        self.errorMessage = nil
    }
}
