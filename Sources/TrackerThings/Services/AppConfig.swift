import Foundation
import SwiftUI

/// Konfigurasi aplikasi termasuk endpoint server yang dapat disesuaikan untuk pengujian perangkat fisik.
@Observable
@MainActor
public final class AppConfig {
    public static let shared = AppConfig()

    private let serverURLKey = "trackerthings_custom_server_url"

    /// URL default server:
    /// Prioritas:
    /// 1. `Info.plist` key `ServerBaseURL` (jika disematkan secara eksplisit saat rilis/packaging IPA)
    /// 2. Standar development: `http://localhost:3000/api`
    ///
    /// Menghindari ketergantungan pada domain Vercel yang belum diverifikasi,
    /// sekaligus memastikan pengujian lokal simulator/perangkat tetap berfungsi tanpa konfigurasi rumit.
    public static var defaultServerURL: String {
        if let plistURL = Bundle.main.object(forInfoDictionaryKey: "ServerBaseURL") as? String {
            let trimmed = plistURL.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty && !trimmed.contains("YOUR_") && !trimmed.contains("example.com") {
                return normalizeURLString(trimmed)
            }
        }
        return "http://localhost:3000/api"
    }

    public static func normalizeURLString(_ input: String) -> String {
        var str = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if str.isEmpty {
            return defaultServerURL
        }
        if !str.lowercased().hasPrefix("http://") && !str.lowercased().hasPrefix("https://") {
            let lower = str.lowercased()
            if lower.hasPrefix("localhost") || lower.hasPrefix("127.0.0.1") || lower.hasPrefix("192.168.") || lower.hasPrefix("10.") {
                str = "http://" + str
            } else {
                str = "https://" + str
            }
        }
        while str.hasSuffix("/") {
            str.removeLast()
        }
        if !str.lowercased().hasSuffix("/api") {
            str += "/api"
        }
        return str
    }

    public var serverURLString: String {
        get {
            let saved = UserDefaults.standard.string(forKey: serverURLKey)
            return (saved?.isEmpty == false) ? saved! : Self.defaultServerURL
        }
        set {
            let normalized = Self.normalizeURLString(newValue)
            UserDefaults.standard.set(normalized, forKey: serverURLKey)
            if let validURL = URL(string: normalized) {
                Task {
                    await NetworkService.shared.setBaseURL(validURL)
                }
            }
        }
    }

    public var isUsingCustomURL: Bool {
        UserDefaults.standard.string(forKey: serverURLKey) != nil
    }

    private init() {
        // Pastikan NetworkService disinkronkan dengan URL tersimpan saat inisialisasi
        let initial = serverURLString
        if let validURL = URL(string: initial) {
            Task {
                await NetworkService.shared.setBaseURL(validURL)
            }
        }
    }

    public var currentBaseURL: URL {
        URL(string: serverURLString) ?? URL(string: Self.defaultServerURL)!
    }

    public func resetToDefault() {
        UserDefaults.standard.removeObject(forKey: serverURLKey)
        let defURL = Self.defaultServerURL
        if let validURL = URL(string: defURL) {
            Task {
                await NetworkService.shared.setBaseURL(validURL)
            }
        }
    }
}

