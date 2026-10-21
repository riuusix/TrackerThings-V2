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
    func updateKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse
    func selesaiKelasPengganti(id: Int) async throws -> BaseResponse
    func deleteKelasPengganti(id: Int) async throws -> BaseResponse

    // MARK: - Schedule Import (OCR & AI Vision)
    func previewScheduleImport(
        fileData: Data,
        fileName: String,
        mimeType: String,
        rawText: String?,
        ocrWordsJson: String?
    ) async throws -> ScheduleImportPreviewResponse

    func visionScheduleImport(fileData: Data, fileName: String, mimeType: String, localItemsJson: String?) async throws -> ScheduleImportPreviewResponse
    func confirmScheduleImport(items: [ImportScheduleItem], learnCorrections: Bool) async throws -> ScheduleImportConfirmResponse
    func syncPendingScheduleDrafts() async throws -> [ScheduleImportConfirmResponse]
}

public extension TrackerDataServiceProtocol {
    func previewScheduleImport(fileData: Data, fileName: String, mimeType: String) async throws -> ScheduleImportPreviewResponse {
        try await previewScheduleImport(
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            rawText: nil,
            ocrWordsJson: nil
        )
    }
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
        do {
            let items: [JadwalItem] = try await network.request(endpoint: "jadwal", method: "GET")
            LocalCacheService.shared.save(items, forKey: LocalCacheService.keyJadwal)
            return items
        } catch {
            if let cached: [JadwalItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal) {
                return cached
            }
            throw error
        }
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
            let items: [TugasItem] = try await network.request(endpoint: "tugas", method: "GET")
            LocalCacheService.shared.save(items, forKey: LocalCacheService.keyTugas)
            return items
        } catch {
            if let cached: [TugasItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyTugas) {
                return cached
            }
            throw error
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
        do {
            let items: [UjianItem] = try await network.request(endpoint: "ujian", method: "GET")
            LocalCacheService.shared.save(items, forKey: LocalCacheService.keyUjian)
            return items
        } catch {
            if let cached: [UjianItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyUjian) {
                return cached
            }
            throw error
        }
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
        do {
            let items: [KelasPenggantiItem] = try await network.request(endpoint: "kelas-pengganti", method: "GET")
            LocalCacheService.shared.save(items, forKey: LocalCacheService.keyKelasPengganti)
            return items
        } catch {
            if let cached: [KelasPenggantiItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyKelasPengganti) {
                return cached
            }
            throw error
        }
    }

    public func createKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "kelas-pengganti", method: "POST", body: body)
    }

    public func updateKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse {
        let body = try encoder.encode(item)
        return try await network.request(endpoint: "kelas-pengganti/\(item.id)", method: "PUT", body: body)
    }

    public func selesaiKelasPengganti(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "kelas-pengganti/\(id)/selesai", method: "POST")
    }

    public func deleteKelasPengganti(id: Int) async throws -> BaseResponse {
        return try await network.request(endpoint: "kelas-pengganti/\(id)", method: "DELETE")
    }

    // MARK: - Schedule Import (OCR & AI Vision)
    public func previewScheduleImport(
        fileData: Data,
        fileName: String,
        mimeType: String,
        rawText: String? = nil,
        ocrWordsJson: String? = nil
    ) async throws -> ScheduleImportPreviewResponse {
        var extra: [String: String] = [:]
        if let text = rawText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            extra["rawText"] = text
        }
        if let words = ocrWordsJson, !words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            extra["ocrWords"] = words
        }
        return try await network.uploadMultipart(
            endpoint: "jadwal/import/preview",
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            fieldName: "file",
            extraFields: extra
        )
    }

    public func visionScheduleImport(fileData: Data, fileName: String, mimeType: String, localItemsJson: String? = nil) async throws -> ScheduleImportPreviewResponse {
        var extra: [String: String] = ["userConsent": "true"]
        if let localJson = localItemsJson, !localJson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            extra["localItems"] = localJson
        }
        return try await network.uploadMultipart(
            endpoint: "jadwal/import/vision",
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            fieldName: "file",
            extraFields: extra
        )
    }

    public func confirmScheduleImport(items: [ImportScheduleItem], learnCorrections: Bool = true) async throws -> ScheduleImportConfirmResponse {
        struct ConfirmPayload: Encodable {
            let items: [ImportScheduleItem]
            let learnCorrections: Bool
        }
        let payload = ConfirmPayload(items: items, learnCorrections: learnCorrections)
        let body = try encoder.encode(payload)
        let response: ScheduleImportConfirmResponse = try await network.request(
            endpoint: "jadwal/import/confirm",
            method: "POST",
            body: body
        )
        // Refresh local cache with latest schedule list after successful import
        _ = try? await getJadwalList()
        return response
    }

    /// Menyinkronkan semua draf jadwal offline berstatus .pendingSync ke server backend saat online
    /// Menerapkan deduplikasi agar tidak menduplikasi jadwal yang sudah tersimpan sebelumnya
    public func syncPendingScheduleDrafts() async throws -> [ScheduleImportConfirmResponse] {
        let isConnected = await NetworkMonitor.shared.isConnected
        guard isConnected else { return [] }

        var drafts = LocalCacheService.shared.loadScheduleDrafts()
        let pending = drafts.filter { $0.status == .pendingSync }
        guard !pending.isEmpty else { return [] }

        var results: [ScheduleImportConfirmResponse] = []
        let currentJadwal = (try? await getJadwalList()) ?? (LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal) ?? [])

        for draft in pending {
            // Deduplikasi: hindari menambahkan mata kuliah yang sudah ada di database / jadwal pengguna
            let uniqueItems = draft.items.filter { draftItem in
                let cleanDraftName = draftItem.namaMatkul.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                let cleanDraftDay = draftItem.hari.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                return !currentJadwal.contains { existing in
                    existing.namaMatkul.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == cleanDraftName &&
                    existing.hari.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == cleanDraftDay &&
                    existing.waktuMulai == draftItem.waktuMulai
                }
            }

            if uniqueItems.isEmpty {
                // Semua item pada draf sudah tersinkron sebelumnya
                if let idx = drafts.firstIndex(where: { $0.id == draft.id }) {
                    drafts[idx].status = .synced
                }
                continue
            }

            do {
                let res = try await confirmScheduleImport(items: uniqueItems, learnCorrections: true)
                results.append(res)
                if let idx = drafts.firstIndex(where: { $0.id == draft.id }) {
                    drafts[idx].status = .synced
                }
            } catch {
                if let idx = drafts.firstIndex(where: { $0.id == draft.id }) {
                    drafts[idx].status = .syncFailed
                    drafts[idx].syncErrorMessage = error.localizedDescription
                }
            }
        }

        // Simpan pembaruan draf dan hapus yang sudah berhasil disinkronkan dari antrean
        drafts.removeAll { $0.status == .synced }
        LocalCacheService.shared.saveScheduleDrafts(drafts)
        return results
    }
}
