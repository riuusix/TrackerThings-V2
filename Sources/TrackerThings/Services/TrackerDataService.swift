import Foundation

public protocol TrackerDataServiceProtocol: Sendable {
    func getJadwalList() async throws -> [JadwalItem]
    func createJadwal(_ item: JadwalItem) async throws -> BaseResponse
    func updateJadwal(_ item: JadwalItem) async throws -> BaseResponse
    func deleteJadwal(id: Int) async throws -> BaseResponse

    func getTugasList() async throws -> [TugasItem]
    func createTugas(_ item: TugasItem) async throws -> BaseResponse
    func updateTugas(_ item: TugasItem) async throws -> BaseResponse
    func updateTugasProgress(id: Int, progress: Int) async throws -> BaseResponse
    func deleteTugas(id: Int) async throws -> BaseResponse

    func getUjianList() async throws -> [UjianItem]
    func createUjian(_ item: UjianItem) async throws -> BaseResponse
    func updateUjian(_ item: UjianItem) async throws -> BaseResponse
    func deleteUjian(id: Int) async throws -> BaseResponse

    func getKelasPenggantiList() async throws -> [KelasPenggantiItem]
    func createKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse
    func selesaiKelasPengganti(id: Int) async throws -> BaseResponse
}

public actor TrackerDataService: TrackerDataServiceProtocol {
    private let network: NetworkService
    private let encoder: JSONEncoder

    public init(network: NetworkService = .shared) {
        self.network = network
        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        self.encoder = enc
    }

    // MARK: - Jadwal
    public func getJadwalList() async throws -> [JadwalItem] {
        return try await network.request(endpoint: "jadwal", method: "GET")
    }

    public func createJadwal(_ item: JadwalItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "jadwal", method: "POST", body: body)
    }

    public func updateJadwal(_ item: JadwalItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "jadwal/\(item.id)", method: "PUT", body: body)
    }

    public func deleteJadwal(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "jadwal/\(id)", method: "DELETE")
    }

    // MARK: - Tugas
    private struct TasksResponse: Decodable {
        let tasks: [TugasItem]
    }

    public func getTugasList() async throws -> [TugasItem] {
        do {
            let res: TasksResponse = try await network.request(endpoint: "tugas", method: "GET")
            return res.tasks
        } catch {
            return try await network.request(endpoint: "tugas", method: "GET")
        }
    }

    public func createTugas(_ item: TugasItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "tugas", method: "POST", body: body)
    }

    public func updateTugas(_ item: TugasItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "tugas/\(item.id)", method: "PUT", body: body)
    }

    public func updateTugasProgress(id: Int, progress: Int) async throws -> BaseResponse {
        let payload: [String: Any] = ["id": id, "progress": progress]
        let body = try JSONSerialization.data(withJSONObject: payload)
        return try await network.request(endpoint: "tugas", method: "PATCH", body: body)
    }

    public func deleteTugas(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "tugas/\(id)", method: "DELETE")
    }

    // MARK: - Ujian
    public func getUjianList() async throws -> [UjianItem] {
        return try await network.request(endpoint: "ujian", method: "GET")
    }

    public func createUjian(_ item: UjianItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "ujian", method: "POST", body: body)
    }

    public func updateUjian(_ item: UjianItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "ujian/\(item.id)", method: "PUT", body: body)
    }

    public func deleteUjian(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "ujian/\(id)", method: "DELETE")
    }

    // MARK: - Kelas Pengganti
    public func getKelasPenggantiList() async throws -> [KelasPenggantiItem] {
        return try await network.request(endpoint: "kelas-pengganti", method: "GET")
    }

    public func createKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "kelas-pengganti", method: "POST", body: body)
    }

    public func selesaiKelasPengganti(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "kelas-pengganti/\(id)/selesai", method: "POST")
    }
}

