import Foundation
import SwiftUI

/// Konfigurasi aplikasi termasuk endpoint server yang dapat disesuaikan untuk pengujian perangkat fisik.
@Observable
@MainActor
public final class AppConfig {
    public static let shared = AppConfig()

    public static let serverURLKey = "trackerthings_custom_server_url"

    /// Base URL produksi bawaan aplikasi (selalu mengarah ke cloud deployment resmi Vercel).
    public static let productionServerURL = "https://trackerthings.vercel.app/api"

    /// Base URL fallback development lokal.
    public static let developmentServerURL = "http://localhost:3000/api"

    /// Mengambil default Server Base URL secara nonisolated dan thread-safe (Swift 6 compliant).
    /// Prioritas:
    /// 1. `Info.plist` key `ServerBaseURL` (jika disematkan secara eksplisit dan valid)
    /// 2. Mode `#if DEBUG`: fallback `http://localhost:3000/api` untuk kenyamanan simulator lokal
    /// 3. Mode Release / Production: selalu default ke `https://trackerthings.vercel.app/api`
    nonisolated public static func resolveDefaultServerURL() -> String {
        if let plistURL = Bundle.main.object(forInfoDictionaryKey: "ServerBaseURL") as? String {
            let trimmed = plistURL.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty && !trimmed.contains("YOUR_") && !trimmed.contains("example.com") {
                return normalizeURLString(trimmed)
            }
        }

        #if DEBUG
        return developmentServerURL
        #else
        return productionServerURL
        #endif
    }

    /// URL default server yang aktif (thread-safe, callable dari MainActor maupun background task).
    nonisolated public static var defaultServerURL: String {
        resolveDefaultServerURL()
    }

    /// Menormalisasi format string URL menjadi URL API yang valid dan berakhiran `/api`.
    nonisolated public static func normalizeURLString(_ input: String) -> String {
        var str = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if str.isEmpty {
            return resolveDefaultServerURL()
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

    /// Mengambil konfigurasi URL aktif dari UserDefaults atau default server secara nonisolated.
    nonisolated public static func resolveActiveServerURL() -> URL {
        if let savedURLStr = UserDefaults.standard.string(forKey: serverURLKey),
           !savedURLStr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let savedURL = URL(string: normalizeURLString(savedURLStr)) {
            return savedURL
        }
        return URL(string: resolveDefaultServerURL()) ?? URL(string: productionServerURL)!
    }

    public var serverURLString: String {
        get {
            let saved = UserDefaults.standard.string(forKey: Self.serverURLKey)
            return (saved?.isEmpty == false) ? saved! : Self.defaultServerURL
        }
        set {
            let normalized = Self.normalizeURLString(newValue)
            UserDefaults.standard.set(normalized, forKey: Self.serverURLKey)
            if let validURL = URL(string: normalized) {
                Task {
                    await NetworkService.shared.setBaseURL(validURL)
                }
            }
        }
    }

    public var isUsingCustomURL: Bool {
        UserDefaults.standard.string(forKey: Self.serverURLKey) != nil
    }

    private init() {
        // Sinkronisasikan NetworkService dengan URL aktif saat inisialisasi
        let initialURL = Self.resolveActiveServerURL()
        Task {
            await NetworkService.shared.setBaseURL(initialURL)
        }
    }

    public var currentBaseURL: URL {
        URL(string: serverURLString) ?? URL(string: Self.defaultServerURL)!
    }

    public func resetToDefault() {
        UserDefaults.standard.removeObject(forKey: Self.serverURLKey)
        let defURL = Self.defaultServerURL
        if let validURL = URL(string: defURL) {
            Task {
                await NetworkService.shared.setBaseURL(validURL)
            }
        }
    }
}
