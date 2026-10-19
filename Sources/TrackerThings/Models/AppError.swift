import Foundation

/// Model Error Terstandarisasi untuk Aplikasi TrackerThings iOS.
/// Menangani pemetaan error jaringan, konektivitas offline, timeout, decoding, validasi form, dan respons API server.
public enum AppError: LocalizedError, Sendable, Identifiable, Equatable {
    case invalidURL
    case offline(String)
    case timeout(String)
    case serverUnreachable(String)
    case networkConnection(String)
    case serverError(code: Int, message: String)
    case decodingError(String)
    case validationError(String)
    case unauthorized
    case cancelled
    case unknown(String)

    public var id: String {
        switch self {
        case .invalidURL:
            return "invalidURL"
        case .offline(let msg):
            return "offline-\(msg)"
        case .timeout(let msg):
            return "timeout-\(msg)"
        case .serverUnreachable(let msg):
            return "unreachable-\(msg)"
        case .networkConnection(let msg):
            return "network-\(msg)"
        case .serverError(let code, let msg):
            return "server-\(code)-\(msg)"
        case .decodingError(let msg):
            return "decoding-\(msg)"
        case .validationError(let msg):
            return "validation-\(msg)"
        case .unauthorized:
            return "unauthorized"
        case .cancelled:
            return "cancelled"
        case .unknown(let msg):
            return "unknown-\(msg)"
        }
    }

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Alamat URL server tidak valid. Periksa konfigurasi jaringan Anda."
        case .offline(let msg):
            return msg.isEmpty ? "Perangkat sedang offline atau koneksi internet terputus. Pastikan Wi-Fi atau data seluler aktif." : msg
        case .timeout(let msg):
            return msg.isEmpty ? "Waktu permintaan habis (timeout). Server membutuhkan waktu terlalu lama untuk merespons. Silakan coba lagi." : msg
        case .serverUnreachable(let msg):
            return msg.isEmpty ? "Tidak dapat menghubungi server TrackerThings. Pastikan server backend sedang aktif dan alamat URL server sudah benar." : msg
        case .networkConnection(let msg):
            return "Koneksi ke server gagal: \(msg). Pastikan backend aktif dan perangkat berada dalam jaringan yang sama."
        case .serverError(_, let message):
            return message
        case .decodingError(let msg):
            return "Gagal memproses data server: \(msg)"
        case .validationError(let msg):
            return msg
        case .unauthorized:
            return "Sesi login Anda telah berakhir. Silakan masuk kembali."
        case .cancelled:
            return "Permintaan dibatalkan."
        case .unknown(let msg):
            return msg
        }
    }

    public static func serverError(statusCode: Int, message: String) -> AppError {
        .serverError(code: statusCode, message: message)
    }

    /// Memeriksa apakah error merupakan pembatalan yang tidak perlu ditampilkan ke UI pengguna.
    public var isCancellation: Bool {
        if case .cancelled = self { return true }
        return false
    }
}

/// Backward compatibility alias agar kode yang mengimpor NetworkError tetap valid.
public typealias NetworkError = AppError
