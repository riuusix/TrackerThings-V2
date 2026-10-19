import Foundation

public extension Notification.Name {
    static let sessionDidExpire = Notification.Name("TrackerThings.sessionDidExpire")
}

private struct DataEnvelope<D: Decodable>: Decodable {
    let data: D
}

private struct UserEnvelope<D: Decodable>: Decodable {
    let user: D
}

private struct TaskEnvelope<D: Decodable>: Decodable {
    let task: D
}

private struct TasksEnvelope<D: Decodable>: Decodable {
    let tasks: D
}

private struct JadwalEnvelope<D: Decodable>: Decodable {
    let jadwal: D
}

private struct ExamsEnvelope<D: Decodable>: Decodable {
    let exams: D
}

private struct KelasPenggantiEnvelope<D: Decodable>: Decodable {
    let kelasPengganti: D
    enum CodingKeys: String, CodingKey {
        case kelasPengganti = "kelas_pengganti"
    }
}

public protocol NetworkServiceProtocol: Sendable {
    func request<T: Decodable & Sendable>(
        endpoint: String,
        method: String,
        body: Data?,
        headers: [String: String]?
    ) async throws -> T

    func uploadMultipart<T: Decodable & Sendable>(
        endpoint: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fieldName: String,
        extraFields: [String: String]
    ) async throws -> T
}

public extension NetworkServiceProtocol {
    func uploadMultipart<T: Decodable & Sendable>(
        endpoint: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fieldName: String
    ) async throws -> T {
        try await uploadMultipart(
            endpoint: endpoint,
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            fieldName: fieldName,
            extraFields: [:]
        )
    }
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
        urlSession: URLSession? = nil
    ) {
        if let customURL = baseURL {
            self.baseURL = customURL
        } else {
            self.baseURL = AppConfig.resolveActiveServerURL()
        }

        if let customSession = urlSession {
            self.urlSession = customSession
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 15.0
            config.timeoutIntervalForResource = 30.0
            config.waitsForConnectivity = false
            self.urlSession = URLSession(configuration: config)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
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
            if let date = isoFractional.date(from: trimmed) {
                return date
            }

            let isoStandard = ISO8601DateFormatter()
            isoStandard.formatOptions = [.withInternetDateTime]
            if let date = isoStandard.date(from: trimmed) {
                return date
            }

            let dfMicro = DateFormatter()
            dfMicro.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZZZZZ"
            dfMicro.locale = Locale(identifier: "en_US_POSIX")
            if let date = dfMicro.date(from: trimmed) {
                return date
            }

            let dfSimple = DateFormatter()
            dfSimple.dateFormat = "yyyy-MM-dd HH:mm:ss"
            dfSimple.locale = Locale(identifier: "en_US_POSIX")
            if let date = dfSimple.date(from: trimmed) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Format tanggal tidak didukung: \(dateStr)"
            )
        }
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
        // 1. Bersihkan base string dari trailing slash dan suffix /api yang mungkin ada
        var base = baseURL.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        while base.hasSuffix("/") {
            base.removeLast()
        }
        if base.lowercased().hasSuffix("/api") {
            base = String(base.dropLast(4))
        }
        while base.hasSuffix("/") {
            base.removeLast()
        }

        // 2. Bersihkan endpoint dari leading/trailing slash dan awalan api/ jika ada
        var ep = endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/ \t\n\r"))
        if ep.lowercased().hasPrefix("api/") {
            ep = String(ep.dropFirst(4))
            ep = ep.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        }

        // 3. Gabungkan secara deterministik ke root /api/
        let fullString = "\(base)/api/\(ep)"
        return URL(string: fullString)
    }

    private func executeDataTask(for request: URLRequest, isIdempotent: Bool) async throws -> (Data, URLResponse) {
        var attempts = 0
        let maxAttempts = isIdempotent ? 2 : 1

        while true {
            attempts += 1
            do {
                return try await urlSession.data(for: request)
            } catch let urlError as URLError {
                if attempts < maxAttempts && (urlError.code == .networkConnectionLost || urlError.code == .timedOut) {
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    continue
                }
                switch urlError.code {
                case .cancelled:
                    throw AppError.cancelled
                case .timedOut:
                    throw AppError.timeout("Waktu permintaan habis (timeout). Server membutuhkan waktu terlalu lama untuk merespons.")
                case .notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .internationalRoamingOff:
                    throw AppError.offline("Koneksi internet terputus atau tidak tersedia. Periksa koneksi jaringan perangkat Anda.")
                case .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed:
                    throw AppError.serverUnreachable("Tidak dapat menghubungi server TrackerThings. Pastikan server aktif dan URL server dapat diakses.")
                default:
                    throw AppError.networkConnection(urlError.localizedDescription)
                }
            } catch is CancellationError {
                throw AppError.cancelled
            } catch let appError as AppError {
                throw appError
            } catch {
                throw AppError.unknown(error.localizedDescription)
            }
        }
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
        request.timeoutInterval = 15.0
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

        let isIdempotent = (method == "GET" || method == "HEAD")
        let (data, response) = try await executeDataTask(for: request, isIdempotent: isIdempotent)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown("Respon tidak valid dari server.")
        }

        if httpResponse.statusCode == 401 {
            // Jika token kedaluwarsa/tidak valid pada request selain login, hapus token
            if !endpoint.contains("auth/login") {
                KeychainHelper.shared.deleteToken()
                self.authToken = nil
                Task { @MainActor in
                    NotificationCenter.default.post(name: .sessionDidExpire, object: nil)
                }
            }

            if let parsedMessage = extractErrorMessage(from: data) {
                throw AppError.serverError(code: 401, message: parsedMessage)
            }
            throw AppError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = extractErrorMessage(from: data) ?? "Server mengembalikan status HTTP \(httpResponse.statusCode)"
            throw AppError.serverError(code: httpResponse.statusCode, message: errorMsg)
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch let primaryError {
            // Dukung standardized response envelope: { success: true, data: T }
            if let envelope = try? jsonDecoder.decode(DataEnvelope<T>.self, from: data) {
                return envelope.data
            }
            if let envelope = try? jsonDecoder.decode(UserEnvelope<T>.self, from: data) {
                return envelope.user
            }
            if let envelope = try? jsonDecoder.decode(TaskEnvelope<T>.self, from: data) {
                return envelope.task
            }
            if let envelope = try? jsonDecoder.decode(TasksEnvelope<T>.self, from: data) {
                return envelope.tasks
            }
            if let envelope = try? jsonDecoder.decode(JadwalEnvelope<T>.self, from: data) {
                return envelope.jadwal
            }
            if let envelope = try? jsonDecoder.decode(ExamsEnvelope<T>.self, from: data) {
                return envelope.exams
            }
            if let envelope = try? jsonDecoder.decode(KelasPenggantiEnvelope<T>.self, from: data) {
                return envelope.kelasPengganti
            }
            throw AppError.decodingError(primaryError.localizedDescription)
        }
    }

    public func uploadMultipart<T: Decodable & Sendable>(
        endpoint: String,
        fileData: Data,
        fileName: String = "avatar.jpg",
        mimeType: String = "image/jpeg",
        fieldName: String = "file",
        extraFields: [String: String] = [:]
    ) async throws -> T {
        guard let url = buildURL(for: endpoint) else {
            throw NetworkError.invalidURL
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30.0
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        for (key, val) in extraFields {
            body.append(Data("--\(boundary)\r\n".utf8))
            body.append(Data("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".utf8))
            body.append(Data("\(val)\r\n".utf8))
        }
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n".utf8))
        body.append(Data("Content-Type: \(mimeType)\r\n\r\n".utf8))
        body.append(fileData)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))

        request.httpBody = body

        let (data, response) = try await executeDataTask(for: request, isIdempotent: false)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown("Respon tidak valid dari server.")
        }

        if httpResponse.statusCode == 401 {
            KeychainHelper.shared.deleteToken()
            self.authToken = nil
            Task { @MainActor in
                NotificationCenter.default.post(name: .sessionDidExpire, object: nil)
            }
            if let parsedMessage = extractErrorMessage(from: data) {
                throw AppError.serverError(code: 401, message: parsedMessage)
            }
            throw AppError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMsg = extractErrorMessage(from: data) ?? "Server mengembalikan status HTTP \(httpResponse.statusCode)"
            throw AppError.serverError(code: httpResponse.statusCode, message: errorMsg)
        }

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch let primaryError {
            if let envelope = try? jsonDecoder.decode(DataEnvelope<T>.self, from: data) {
                return envelope.data
            }
            if let envelope = try? jsonDecoder.decode(UserEnvelope<T>.self, from: data) {
                return envelope.user
            }
            throw AppError.decodingError(primaryError.localizedDescription)
        }
    }

    private func extractErrorMessage(from data: Data) -> String? {
        struct APIErrorResponse: Decodable {
            let message: String?
            let error: String?
            let code: Int?
        }
        if let decoded = try? jsonDecoder.decode(APIErrorResponse.self, from: data) {
            return decoded.message ?? decoded.error
        }
        if let text = String(data: data, encoding: .utf8) {
            if text.contains("<!DOCTYPE html") || text.contains("<html") {
                if text.contains("404") {
                    return "Endpoint API tidak ditemukan (HTTP 404). Pastikan URL server benar dan route /api tersedia."
                } else if text.contains("500") {
                    return "Terjadi kesalahan internal pada server backend (HTTP 500)."
                }
                return "Server mengembalikan halaman web (HTML), bukan respon JSON."
            }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty && trimmed.count < 300 {
                return trimmed
            }
        }
        return nil
    }
}
