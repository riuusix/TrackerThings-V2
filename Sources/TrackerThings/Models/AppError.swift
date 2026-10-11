import Foundation

/// Model Error Terstandarisasi untuk Aplikasi TrackerThings iOS.
/// Menangani pemetaan error jaringan, decoding, validasi form, dan respons API server.
public enum AppError: LocalizedError, Sendable, Identifiable, Equatable {
    case invalidURL
    case networkConnection(String)
    case serverError(code: Int, message: String)
    case decodingError(String)
    case validationError(String)
    case unauthorized
    case unknown(String)

    public var id: String {
        switch self {
        case .invalidURL: 
            return "invalidURL"
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
        case .unknown(let msg): 
            return "unknown-\(msg)"
        }
    }

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Alamat URL server tidak valid. Periksa konfigurasi jaringan Anda."
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
        case .unknown(let msg):
            return msg
        }
    }

    public static func serverError(statusCode: Int, message: String) -> AppError {
        .serverError(code: statusCode, message: message)
    }
}

/// Backward compatibility alias agar kode yang mengimpor NetworkError tetap valid.
public typealias NetworkError = AppError

