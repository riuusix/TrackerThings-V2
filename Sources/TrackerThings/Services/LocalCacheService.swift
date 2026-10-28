import Foundation

/// Service penyimpanan data lokal (offline cache) yang persisten dan terisolasi.
/// Menggunakan FileManager (JSON files di applicationSupportDirectory) yang aman, deterministik,
/// dan tidak bergantung pada framework eksternal.
public final class LocalCacheService: Sendable {
    public static let shared = LocalCacheService()

    private let lock = NSLock()
    private var fileManager: FileManager {
        FileManager.default
    }
    private let cacheDirectoryURL: URL

    private init() {
        let fm = FileManager.default
        let urls = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = urls.first ?? fm.temporaryDirectory
        let cacheFolder = appSupport.appendingPathComponent("TrackerThingsCache", isDirectory: true)

        if !fm.fileExists(atPath: cacheFolder.path) {
            try? fm.createDirectory(at: cacheFolder, withIntermediateDirectories: true)
        }
        self.cacheDirectoryURL = cacheFolder
    }

    private func fileURL(for key: String) -> URL {
        cacheDirectoryURL.appendingPathComponent("\(key).json")
    }

    private var jsonEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    private var jsonDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { d in
            let container = try d.singleValueContainer()
            let dateStr = try container.decode(String.self)
            let trimmed = dateStr.trimmingCharacters(in: .whitespacesAndNewlines)

            // 1. Tanggal kalender (date-only YYYY-MM-DD atau representasi UTC midnight T00:00:00)
            if trimmed.count == 10, trimmed.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
                return CalendarDateHelper.parseCalendarDate(trimmed)
            }
            if (trimmed.contains("T00:00:00") || trimmed.contains(" 00:00:00")),
               trimmed.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) != nil {
                return CalendarDateHelper.parseCalendarDate(trimmed)
            }

            // 2. Timestamp absolut (ISO 8601 dengan waktu spesifik / fractional seconds)
            let isoFractional = ISO8601DateFormatter()
            isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFractional.date(from: trimmed) { return date }

            let isoStandard = ISO8601DateFormatter()
            isoStandard.formatOptions = [.withInternetDateTime]
            if let date = isoStandard.date(from: trimmed) { return date }

            let dfSimple = DateFormatter()
            dfSimple.dateFormat = "yyyy-MM-dd HH:mm:ss"
            dfSimple.locale = Locale(identifier: "en_US_POSIX")
            if let date = dfSimple.date(from: trimmed) { return date }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Format tanggal tidak didukung: \(dateStr)"
            )
        }
        return decoder
    }

    // MARK: - Generic Save & Load

    public func save<T: Encodable & Sendable>(_ data: T, forKey key: String) {
        let url = fileURL(for: key)
        do {
            let encoded = try jsonEncoder.encode(data)
            lock.lock()
            defer { lock.unlock() }
            try encoded.write(to: url, options: [.atomic])
            // Simpan timestamp kapan cache disimpan
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "cache_timestamp_\(key)")
        } catch {
            // Abaikan kegagalan tulis cache tanpa mengganggu alur pengguna
        }
    }

    public func load<T: Decodable & Sendable>(forKey key: String) -> T? {
        let url = fileURL(for: key)
        lock.lock()
        guard fileManager.fileExists(atPath: url.path) else {
            lock.unlock()
            return nil
        }
        let data: Data
        do {
            data = try Data(contentsOf: url)
            lock.unlock()
        } catch {
            lock.unlock()
            return nil
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch {
            return nil
        }
    }

    public func remove(forKey key: String) {
        let url = fileURL(for: key)
        lock.lock()
        defer { lock.unlock() }
        try? fileManager.removeItem(at: url)
        UserDefaults.standard.removeObject(forKey: "cache_timestamp_\(key)")
    }

    public func getCacheDate(forKey key: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        let timestamp = UserDefaults.standard.double(forKey: "cache_timestamp_\(key)")
        guard timestamp > 0 else { return nil }
        return Date(timeIntervalSince1970: timestamp)
    }

    public func clearAllCache() {
        lock.lock()
        defer { lock.unlock() }
        try? fileManager.removeItem(at: cacheDirectoryURL)
        try? fileManager.createDirectory(at: cacheDirectoryURL, withIntermediateDirectories: true)
    }

    // MARK: - Specialized Convenience Keys
    public static let keyUserProfile = "cached_user_profile"
    public static let keyJadwal = "cached_jadwal_list"
    public static let keyTugas = "cached_tugas_list"
    public static let keyUjian = "cached_ujian_list"
    public static let keyKelasPengganti = "cached_kelas_pengganti_list"
    public static let keyAcademicIntelligence = "cached_academic_intelligence"
    public static let keyOfflineScheduleDrafts = "cached_offline_schedule_drafts"
    public static let keyLastSync = "cached_last_sync_timestamp"

    // MARK: - Last Sync Timestamp
    public func saveLastSyncDate(_ date: Date = Date()) {
        save(date, forKey: Self.keyLastSync)
    }

    public func getLastSyncDate() -> Date? {
        load(forKey: Self.keyLastSync)
    }

    // MARK: - Offline Schedule Drafts Persistence
    public func saveScheduleDrafts(_ drafts: [OfflineScheduleDraft]) {
        save(drafts, forKey: Self.keyOfflineScheduleDrafts)
    }

    public func loadScheduleDrafts() -> [OfflineScheduleDraft] {
        load(forKey: Self.keyOfflineScheduleDrafts) ?? []
    }

    public func saveScheduleDraft(_ draft: OfflineScheduleDraft) {
        var existing = loadScheduleDrafts()
        if let index = existing.firstIndex(where: { $0.id == draft.id }) {
            existing[index] = draft
        } else {
            existing.append(draft)
        }
        saveScheduleDrafts(existing)
    }

    public func removeScheduleDraft(id: String) {
        var existing = loadScheduleDrafts()
        existing.removeAll { $0.id == id }
        saveScheduleDrafts(existing)
    }
}
