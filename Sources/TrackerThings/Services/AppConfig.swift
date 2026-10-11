import Foundation
import SwiftUI

/// Konfigurasi aplikasi termasuk endpoint server yang dapat disesuaikan untuk pengujian perangkat fisik.
@Observable
@MainActor
public final class AppConfig {
    public static let shared = AppConfig()

    private let serverURLKey = "trackerthings_custom_server_url"
    public static let defaultServerURL = "http://localhost:3000/api"

    public static func normalizeURLString(_ input: String) -> String {
        var str = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if str.isEmpty {
            return defaultServerURL
        }
        if !str.lowercased().hasPrefix("http://") && !str.lowercased().hasPrefix("https://") {
            str = "http://" + str
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
        serverURLString = Self.defaultServerURL
    }
}

