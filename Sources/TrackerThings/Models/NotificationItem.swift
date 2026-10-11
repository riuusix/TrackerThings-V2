import Foundation

public struct NotificationItem: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let judul: String
    public let namaMatkul: String
    public let waktu: String
    public let tipe: TipeNotifikasi
    public let isUrgent: Bool

    public enum TipeNotifikasi: String, Codable, Sendable {
        case tugas = "Tugas"
        case ujian = "Ujian"
    }

    public init(
        id: String,
        judul: String,
        namaMatkul: String,
        waktu: String,
        tipe: TipeNotifikasi,
        isUrgent: Bool = false
    ) {
        self.id = id
        self.judul = judul
        self.namaMatkul = namaMatkul
        self.waktu = waktu
        self.tipe = tipe
        self.isUrgent = isUrgent
    }
}

