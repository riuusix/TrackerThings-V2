import Foundation

/// Service penyimpanan data lokal (offline cache) yang persisten dan terisolasi.
/// Menggunakan FileManager (JSON files di applicationSupportDirectory) yang aman, deterministik,
/// dan tidak bergantung pada framework eksternal.
public final class LocalCacheService: Sendable {
    public static let shared = LocalCacheService()

    private let fileManager = FileManager.default
    private let cacheDirectoryURL: URL

    private init() {
        let urls = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let appSupport = urls.first ?? fileManager.temporaryDirectory
        let cacheFolder = appSupport.appendingPathComponent("TrackerThingsCache", isDirectory: true)

        if !fileManager.fileExists(atPath: cacheFolder.path) {
            try? fileManager.createDirectory(at: cacheFolder, withIntermediateDirectories: true)
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

            let isoFractional = ISO8601DateFormatter()
            isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = isoFractional.date(from: dateStr) { return date }

            let isoStandard = ISO8601DateFormatter()
            isoStandard.formatOptions = [.withInternetDateTime]
            if let date = isoStandard.date(from: dateStr) { return date }

            let dfDateOnly = DateFormatter()
            dfDateOnly.dateFormat = "yyyy-MM-dd"
            dfDateOnly.locale = Locale(identifier: "en_US_POSIX")
            dfDateOnly.timeZone = TimeZone(secondsFromGMT: 0)
            if let date = dfDateOnly.date(from: dateStr) { return date }

            let dfSimple = DateFormatter()
            dfSimple.dateFormat = "yyyy-MM-dd HH:mm:ss"
            dfSimple.locale = Locale(identifier: "en_US_POSIX")
            if let date = dfSimple.date(from: dateStr) { return date }

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
            try encoded.write(to: url, options: [.atomic])
            // Simpan timestamp kapan cache disimpan
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "cache_timestamp_\(key)")
        } catch {
            // Abaikan kegagalan tulis cache tanpa mengganggu alur pengguna
        }
    }

    public func load<T: Decodable & Sendable>(forKey key: String) -> T? {
        let url = fileURL(for: key)
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        do {
            let data = try Data(contentsOf: url)
            return try jsonDecoder.decode(T.self, from: data)
        } catch {
            return nil
        }
    }

    public func remove(forKey key: String) {
        let url = fileURL(for: key)
        try? fileManager.removeItem(at: url)
        UserDefaults.standard.removeObject(forKey: "cache_timestamp_\(key)")
    }

    public func getCacheDate(forKey key: String) -> Date? {
        let timestamp = UserDefaults.standard.double(forKey: "cache_timestamp_\(key)")
        guard timestamp > 0 else { return nil }
        return Date(timeIntervalSince1970: timestamp)
    }

    public func clearAllCache() {
        try? fileManager.removeItem(at: cacheDirectoryURL)
        try? fileManager.createDirectory(at: cacheDirectoryURL, withIntermediateDirectories: true)
    }

    // MARK: - Specialized Convenience Keys
    public static let keyUserProfile = "cached_user_profile"
    public static let keyJadwal = "cached_jadwal_list"
    public static let keyTugas = "cached_tugas_list"
    public static let keyUjian = "cached_ujian_list"
    public static let keyKelasPengganti = "cached_kelas_pengganti_list"
}

