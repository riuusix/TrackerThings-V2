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
    func request<T: Decodable>(
        endpoint: String,
        method: String,
        body: Data?,
        headers: [String: String]?
    ) async throws -> T
}

public actor NetworkService: NetworkServiceProtocol {
    public static let shared = NetworkService()

    private let baseURL: URL
    private let urlSession: URLSession
    private let jsonDecoder: JSONDecoder
    private let jsonEncoder: JSONEncoder
    private var authToken: String?

    public init(
        baseURL: URL = URL(string: "http://localhost:3000/api")!,
        urlSession: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.urlSession = urlSession

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.jsonDecoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.jsonEncoder = encoder
    }

    public func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    public func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        guard let url = URL(string: endpoint, relativeTo: baseURL) else {
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
            throw NetworkError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
            throw NetworkError.serverError(statusCode: httpResponse.statusCode, message: errorMsg)
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch {
            throw NetworkError.decodingError(error.localizedDescription)
        }
    }
}

