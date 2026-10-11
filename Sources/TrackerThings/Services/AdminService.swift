import Foundation

/// Kontrak protokol untuk layanan admin panel (RBAC)
public protocol AdminServiceProtocol: Sendable {
    func fetchDashboardMetrics() async throws -> AdminDashboardData
}

/// Implementasi layanan admin panel berbasis NetworkService
public actor AdminService: AdminServiceProtocol {
    private let network: NetworkService

    public init(network: NetworkService = .shared) {
        self.network = network
    }

    /// Mengambil metrik sistem & aktivitas pengguna (hanya dapat diakses role admin)
    public func fetchDashboardMetrics() async throws -> AdminDashboardData {
        return try await network.request(
            endpoint: "admin/dashboard",
            method: "GET"
        )
    }
}

