import Foundation

public enum NetworkError: LocalizedError, Sendable {
    case invalidURL
    case serverError(statusCode: Int, message: String)
    case decodingError(String)
    case unauthorized
    case unknown(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL tidak valid."
        case .serverError(let statusCode, let message):
            return "Server error (\(statusCode)): \(message)"
        case .decodingError(let msg):
            return "Gagal memproses respon server: \(msg)"
        case .unauthorized:
            return "Sesi login telah berakhir. Silakan masuk kembali."
        case .unknown(let msg):
            return msg
        }
    }
}

public protocol NetworkServiceProtocol: Sendable {
    func request<T: Decodable & Sendable>(
        endpoint: String,
        method: String,
        body: Data?,
        headers: [String: String]?
    ) async throws -> T
}

public actor NetworkService: NetworkServiceProtocol {
    public static let shared = NetworkService()

    private var baseURL: URL
    private let urlSession: URLSession
    private let jsonDecoder: JSONDecoder
    private let jsonEncoder: JSONEncoder
    private var authToken: String?

    public init(
        baseURL: URL? = nil,
        urlSession: URLSession = .shared
    ) {
        if let customURL = baseURL {
            self.baseURL = customURL
        } else if let savedURLStr = UserDefaults.standard.string(forKey: "trackerthings_custom_server_url"),
                  let savedURL = URL(string: savedURLStr) {
            self.baseURL = savedURL
        } else {
            self.baseURL = URL(string: "http://localhost:3000/api")!
        }

        self.urlSession = urlSession

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.jsonDecoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.jsonEncoder = encoder

        // Muat token awal dari Keychain secara aman jika tersedia
        self.authToken = KeychainHelper.shared.getToken()
    }

    public func setBaseURL(_ url: URL) {
        self.baseURL = url
    }

    public func getBaseURL() -> URL {
        return self.baseURL
    }

    public func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    private func buildURL(for endpoint: String) -> URL? {
        let cleanEndpoint = endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        var baseString = baseURL.absoluteString
        if !baseString.hasSuffix("/") {
            baseString += "/"
        }
        return URL(string: cleanEndpoint, relativeTo: URL(string: baseString))?.absoluteURL
    }

    public func request<T: Decodable & Sendable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        guard let url = buildURL(for: endpoint) else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let headers = headers {
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }

        if let body = body {
            request.httpBody = body
        }

        let (data, response) = try await urlSession.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown("Respon tidak valid dari server.")
        }

        if httpResponse.statusCode == 401 {
            // Jika token kedaluwarsa/tidak valid pada request selain login, hapus token
            if !endpoint.contains("auth/login") {
                KeychainHelper.shared.deleteToken()
                self.authToken = nil
            }

            if let parsedMessage = extractErrorMessage(from: data) {
                throw NetworkError.serverError(statusCode: 401, message: parsedMessage)
            }
            throw NetworkError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = extractErrorMessage(from: data) ?? (String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)")
            throw NetworkError.serverError(statusCode: httpResponse.statusCode, message: errorMsg)
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch {
            throw NetworkError.decodingError(error.localizedDescription)
        }
    }

    private func extractErrorMessage(from data: Data) -> String? {
        struct APIErrorResponse: Decodable {
            let error: String?
            let message: String?
        }
        if let decoded = try? jsonDecoder.decode(APIErrorResponse.self, from: data) {
            return decoded.error ?? decoded.message
        }
        return nil
    }
}

