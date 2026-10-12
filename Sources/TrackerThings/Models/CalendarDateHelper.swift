import Foundation

/// Helper untuk serialisasi dan deserialisasi tanggal kalender (date-only: YYYY-MM-DD).
/// Tanggal kalender (seperti deadline tugas, tanggal ujian, tanggal kelas pengganti)
/// TIDAK memiliki komponen jam dan tidak terikat zona waktu tertentu.
/// Nilai ini dipetakan secara konsisten ke kalender lokal perangkat (Calendar.current).
public enum CalendarDateHelper: Sendable {
    /// Mengonversi Date kalender lokal perangkat ke string "YYYY-MM-DD"
    public static func formatCalendarDate(_ date: Date) -> String {
        let calendar = Calendar.current
        let year = calendar.component(.year, from: date)
        let month = calendar.component(.month, from: date)
        let day = calendar.component(.day, from: date)
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// Mengonversi string kalender ("YYYY-MM-DD" atau string ISO) menjadi Date
    /// yang merepresentasikan awal hari kalender tersebut pada zona waktu lokal perangkat (Calendar.current).
    public static func parseCalendarDate(_ string: String) -> Date {
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)

        // 1. Ekstrak YYYY-MM-DD dari awal string
        if let match = trimmed.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) {
            let ymd = String(trimmed[match])
            let parts = ymd.split(separator: "-")
            if parts.count == 3,
               let y = Int(parts[0]),
               let m = Int(parts[1]),
               let d = Int(parts[2]) {
                var comps = DateComponents()
                comps.year = y
                comps.month = m
                comps.day = d
                comps.hour = 0
                comps.minute = 0
                comps.second = 0
                if let localDate = Calendar.current.date(from: comps) {
                    return localDate
                }
            }
        }

        // 2. Fallback untuk ISO8601 lengkap jika format tidak diawali YYYY-MM-DD
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: trimmed) {
            return d
        }
        let isoSimple = ISO8601DateFormatter()
        isoSimple.formatOptions = [.withInternetDateTime]
        if let d = isoSimple.date(from: trimmed) {
            return d
        }

        return Date()
    }
}

