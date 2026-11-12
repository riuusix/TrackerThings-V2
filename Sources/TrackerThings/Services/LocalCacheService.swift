import Foundation

/// Service penyimpanan data lokal (memory + disk offline cache) yang persisten, user-scoped, dan terisolasi.
/// Menggunakan in-memory TTL store yang dipadukan dengan FileManager (JSON files di applicationSupportDirectory)
/// sehingga bebas kebocoran data lintas akun dan menghindari pembacaan disk/jaringan berulang.
public final class LocalCacheService: @unchecked Sendable {
    public static let shared = LocalCacheService()

    private let lock = NSLock()
    private var fileManager: FileManager {
        FileManager.default
    }
    private let cacheDirectoryURL: URL

    /// Scope pengguna aktif (`"user_12"` atau `"global"` jika belum teridentifikasi).
    private var activeUserScope: String = "global"

    /// Penyimpanan memori cepat `(scopedKey -> (data: Data, savedAt: Date))`
    private var memoryStore: [String: (data: Data, savedAt: Date)] = [:]

    /// Kebijakan TTL segar default per resource (dalam detik)
    public static let defaultFreshTTL: TimeInterval = 30.0
    public static let scheduleFreshTTL: TimeInterval = 60.0
    public static let intelligenceFreshTTL: TimeInterval = 45.0

    private init() {
        let fm = FileManager.default
        let urls = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = urls.first ?? fm.temporaryDirectory
        let cacheFolder = appSupport.appendingPathComponent("TrackerThingsCache", isDirectory: true)

        if !fm.fileExists(atPath: cacheFolder.path) {
            try? fm.createDirectory(at: cacheFolder, withIntermediateDirectories: true)
        }
        self.cacheDirectoryURL = cacheFolder

        // Inisialisasi scope pengguna dari token Keychain yang ada (jika tersedia)
        if let token = KeychainHelper.shared.getToken(),
           let payload = JWTTokenHelper.decode(token: token),
           let uid = payload.userId {
            self.activeUserScope = "user_\(uid)"
        }
    }

    // MARK: - User Scope Management

    /// Mengatur namespace pengguna aktif berdasarkan ID pengguna atau JWT token.
    /// Jika pengguna berganti akun, cache memori akun sebelumnya dibersihkan secara otomatis.
    public func setUserScope(userId: Int?) {
        lock.lock()
        defer { lock.unlock() }
        let nextScope = userId.map { "user_\($0)" } ?? "global"
        if activeUserScope != nextScope {
            memoryStore.removeAll()
            activeUserScope = nextScope
        }
    }

    public func currentUserScope() -> String {
        lock.lock()
        defer { lock.unlock() }
        return activeUserScope
    }

    private func resolveScopedKey(for key: String) -> String {
        // Key global seperti draf jadwal offline tetap memakai nama kanonik atau scope aktif secara konsisten
        if key == Self.keyUserProfile {
            return "\(activeUserScope)_\(key)"
        }
        return "\(activeUserScope)_\(key)"
    }

    private func fileURL(forScopedKey scopedKey: String) -> URL {
        cacheDirectoryURL.appendingPathComponent("\(scopedKey).json")
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

    // MARK: - Generic Save, Load & TTL Validation

    public func save<T: Encodable & Sendable>(_ data: T, forKey key: String) {
        do {
            let encoded = try jsonEncoder.encode(data)
            let now = Date()
            lock.lock()
            let scopedKey = resolveScopedKey(for: key)
            let url = fileURL(forScopedKey: scopedKey)
            memoryStore[scopedKey] = (data: encoded, savedAt: now)
            try? encoded.write(to: url, options: [.atomic])
            UserDefaults.standard.set(now.timeIntervalSince1970, forKey: "cache_timestamp_\(scopedKey)")
            UserDefaults.standard.set(now.timeIntervalSince1970, forKey: "cache_timestamp_\(key)")
            lock.unlock()
        } catch {
            // Abaikan kegagalan tulis cache tanpa mengganggu alur pengguna
        }
    }

    public func load<T: Decodable & Sendable>(forKey key: String) -> T? {
        lock.lock()
        let scopedKey = resolveScopedKey(for: key)

        if let memEntry = memoryStore[scopedKey] {
            lock.unlock()
            if let decoded = try? jsonDecoder.decode(T.self, from: memEntry.data) {
                return decoded
            }
            lock.lock()
        }

        let scopedURL = fileURL(forScopedKey: scopedKey)
        let fallbackLegacyURL = fileURL(forScopedKey: key)
        let targetURL: URL
        if fileManager.fileExists(atPath: scopedURL.path) {
            targetURL = scopedURL
        } else if activeUserScope == "global" && fileManager.fileExists(atPath: fallbackLegacyURL.path) {
            targetURL = fallbackLegacyURL
        } else {
            lock.unlock()
            return nil
        }

        let data: Data
        do {
            data = try Data(contentsOf: targetURL)
            let ts = UserDefaults.standard.double(forKey: "cache_timestamp_\(scopedKey)")
            let savedDate = ts > 0 ? Date(timeIntervalSince1970: ts) : Date.distantPast
            memoryStore[scopedKey] = (data: data, savedAt: savedDate)
            lock.unlock()
        } catch {
            lock.unlock()
            return nil
        }

        return try? jsonDecoder.decode(T.self, from: data)
    }

    /// Memeriksa apakah cache untuk key tertentu masih berada dalam jendela TTL segar (`ttlSeconds`).
    public func isFresh(forKey key: String, ttlSeconds: TimeInterval = LocalCacheService.defaultFreshTTL) -> Bool {
        lock.lock()
        let scopedKey = resolveScopedKey(for: key)
        if let mem = memoryStore[scopedKey] {
            let age = Date().timeIntervalSince(mem.savedAt)
            lock.unlock()
            return age >= 0 && age <= ttlSeconds
        }
        let timestamp = UserDefaults.standard.double(forKey: "cache_timestamp_\(scopedKey)")
        lock.unlock()
        guard timestamp > 0 else { return false }
        let age = Date().timeIntervalSince1970 - timestamp
        return age >= 0 && age <= ttlSeconds
    }

    /// Membatalkan kesegaran TTL untuk satu key tanpa menghapus data disk (agar fallback offline tetap tersedia).
    public func invalidateFreshness(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        let scopedKey = resolveScopedKey(for: key)
        if let existing = memoryStore[scopedKey] {
            memoryStore[scopedKey] = (data: existing.data, savedAt: .distantPast)
        }
        UserDefaults.standard.removeObject(forKey: "cache_timestamp_\(scopedKey)")
    }

    public func remove(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        let scopedKey = resolveScopedKey(for: key)
        memoryStore.removeValue(forKey: scopedKey)
        let url = fileURL(forScopedKey: scopedKey)
        try? fileManager.removeItem(at: url)
        let legacyURL = fileURL(forScopedKey: key)
        try? fileManager.removeItem(at: legacyURL)
        UserDefaults.standard.removeObject(forKey: "cache_timestamp_\(scopedKey)")
        UserDefaults.standard.removeObject(forKey: "cache_timestamp_\(key)")
    }

    public func getCacheDate(forKey key: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        let scopedKey = resolveScopedKey(for: key)
        if let mem = memoryStore[scopedKey], mem.savedAt > .distantPast {
            return mem.savedAt
        }
        let scopedTs = UserDefaults.standard.double(forKey: "cache_timestamp_\(scopedKey)")
        if scopedTs > 0 {
            return Date(timeIntervalSince1970: scopedTs)
        }
        let legacyTs = UserDefaults.standard.double(forKey: "cache_timestamp_\(key)")
        guard legacyTs > 0 else { return nil }
        return Date(timeIntervalSince1970: legacyTs)
    }

    public func clearAllCache() {
        lock.lock()
        defer { lock.unlock() }
        memoryStore.removeAll()
        activeUserScope = "global"
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
