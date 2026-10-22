import Foundation

/// Parser deterministik lokal untuk mengekstrak baris jadwal kuliah Indonesia dari hasil OCR offline.
/// Mendukung layout baris tabel standar (Siakad, ITB, UI, format kolom umum) tanpa dependensi eksternal.
public struct LocalScheduleExtractor: Sendable {
    private static let validDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

    private static let dayAliases: [String: String] = [
        "senin": "Senin", "sen1n": "Senin", "senln": "Senin", "snn": "Senin", "mon": "Senin", "monday": "Senin",
        "selasa": "Selasa", "se1asa": "Selasa", "selas4": "Selasa", "sls": "Selasa", "tue": "Selasa", "tuesday": "Selasa",
        "rabu": "Rabu", "r4bu": "Rabu", "wed": "Rabu", "wednesday": "Rabu",
        "kamis": "Kamis", "kam1s": "Kamis", "k4mis": "Kamis", "kms": "Kamis", "thu": "Kamis", "thursday": "Kamis",
        "jumat": "Jumat", "jum'at": "Jumat", "jumaat": "Jumat", "jum4t": "Jumat", "jmt": "Jumat", "fri": "Jumat", "friday": "Jumat",
        "sabtu": "Sabtu", "s4btu": "Sabtu", "sat": "Sabtu", "saturday": "Sabtu",
        "minggu": "Minggu", "m1nggu": "Minggu", "sun": "Minggu", "sunday": "Minggu"
    ]

    /// Mengekstrak daftar item jadwal dari hasil OCR Apple Vision secara deterministik di perangkat.
    public static func extract(from ocrResult: LocalOcrResult) -> [ImportScheduleItem] {
        var items: [ImportScheduleItem] = []
        var linesToProcess: [String] = []

        if !ocrResult.words.isEmpty {
            linesToProcess = clusterWordsIntoLines(ocrResult.words)
        }
        if linesToProcess.isEmpty {
            linesToProcess = ocrResult.lines
        }

        var lastValidHari: String? = nil

        for (index, line) in linesToProcess.enumerated() {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }

            // Lewati baris judul / header dokumen atau header tabel
            let lower = trimmed.lowercased()
            if isHeaderLine(lower) {
                continue
            }

            // Tangani baris judul seksi hari tunggal (contoh: "SENIN" atau "=== SENIN ===")
            let cleanLower = lower.replacingOccurrences(of: "^(?:hari\\s*:?\\s*|=+\\s*)", with: "", options: .regularExpression)
                .replacingOccurrences(of: "\\s*=+$", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let matchedDay = dayAliases[cleanLower] {
                lastValidHari = matchedDay
                continue
            }

            if var item = parseScheduleLine(trimmed, rowIndex: index + 1) {
                if item.hari.isEmpty && !item.waktuMulai.isEmpty && lastValidHari != nil {
                    item.hari = lastValidHari!
                    if var raw = item.rawFields {
                        raw["hari"] = lastValidHari!
                        item.rawFields = raw
                    } else {
                        item.rawFields = ["hari": lastValidHari!]
                    }
                    item.needsReview = item.waktuMulai.isEmpty || item.waktuSelesai.isEmpty
                    item.recognitionStatus = item.needsReview ? "needs_review" : "high_confidence"
                } else if !item.hari.isEmpty {
                    lastValidHari = item.hari
                }
                items.append(item)
            }
        }

        return items
    }

    /// Mengelompokkan observasi kata OCR secara spasial berdasarkan koordinat Y menjadi baris-baris visual
    public static func clusterWordsIntoLines(_ words: [OcrWord]) -> [String] {
        let valid = words.filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        guard !valid.isEmpty else { return [] }

        // Cek apakah koordinat dalam skala normalisasi [0.0 ... 1.0] atau pixel
        var maxY = 0.0
        for w in valid {
            if w.bbox.y1 > maxY { maxY = w.bbox.y1 }
        }
        let isNormalized = maxY <= 1.05 && maxY > 0
        let verticalTolerance = isNormalized ? 0.018 : 12.0

        // Urutkan berdasarkan yCenter
        let sorted = valid.sorted { w1, w2 in
            let y1 = (w1.bbox.y0 + w1.bbox.y1) / 2.0
            let y2 = (w2.bbox.y0 + w2.bbox.y1) / 2.0
            if abs(y1 - y2) > (isNormalized ? 0.005 : 4.0) {
                return y1 < y2
            }
            return w1.bbox.x0 < w2.bbox.x0
        }

        var lines: [[OcrWord]] = []
        for w in sorted {
            let yc = (w.bbox.y0 + w.bbox.y1) / 2.0
            var matchedIndex: Int? = nil

            for i in stride(from: lines.count - 1, through: max(0, lines.count - 4), by: -1) {
                let lineWords = lines[i]
                let lineYc = lineWords.reduce(0.0) { $0 + ($1.bbox.y0 + $1.bbox.y1) / 2.0 } / Double(lineWords.count)
                if abs(yc - lineYc) <= verticalTolerance {
                    matchedIndex = i
                    break
                }
            }

            if let idx = matchedIndex {
                lines[idx].append(w)
            } else {
                lines.append([w])
            }
        }

        return lines.map { lineWords in
            let sortedInLine = lineWords.sorted { $0.bbox.x0 < $1.bbox.x0 }
            return sortedInLine.map { $0.text }.joined(separator: " ")
        }
    }

    private static func isHeaderLine(_ lower: String) -> Bool {
        let headers = ["jadwal kuliah", "kartu rencana", "fakultas", "universitas", "krs", "daftar mata kuliah"]
        if headers.contains(where: { lower.contains($0) }) && !lower.contains("08:") && !lower.contains("09:") && !lower.contains("10:") {
            return true
        }
        let colHeaders = ["no", "kode mk", "mata kuliah", "waktu", "ruang", "dosen", "hari", "sks"]
        let matchCount = colHeaders.filter { lower.contains($0) }.count
        return matchCount >= 3
    }

    /// Membedah satu baris teks jadwal menjadi komponen Canonical / ImportScheduleItem
    public static func parseScheduleLine(_ line: String, rowIndex: Int) -> ImportScheduleItem? {
        let tokens = line.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        guard tokens.count >= 2 else { return nil }

        var hari: String? = nil
        var waktuMulai: String? = nil
        var waktuSelesai: String? = nil
        var kodeMatkul: String? = nil
        var sks: Int? = nil
        var kelas: String? = nil
        var lokasi: String? = nil
        var dosen: String? = nil

        // 1. Ekstraksi Hari
        for token in tokens {
            let cleanToken = token.lowercased().trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
            if let matchedDay = dayAliases[cleanToken] {
                hari = matchedDay
                break
            }
        }

        // 2. Ekstraksi Rentang Waktu (HH:mm - HH:mm atau HH.mm - HH.mm atau HH:mm HH:mm)
        let timePattern = #"(\d{1,2}[:.]\d{2})(?:\s*(?:[-–—]|s/d|sd|sampai|to)\s*|\s+)(\d{1,2}[:.]\d{2})"#
        if let timeRegex = try? NSRegularExpression(pattern: timePattern, options: .caseInsensitive) {
            let nsString = line as NSString
            if let match = timeRegex.firstMatch(in: line, options: [], range: NSRange(location: 0, length: nsString.length)) {
                let r1 = match.range(at: 1)
                let r2 = match.range(at: 2)
                if r1.location != NSNotFound && r2.location != NSNotFound {
                    waktuMulai = formatTime(nsString.substring(with: r1))
                    waktuSelesai = formatTime(nsString.substring(with: r2))
                }
            }
        }

        // 3. Ekstraksi Kode MK (contoh: IF253418, CS101, TIF-301)
        let codePattern = #"\b([A-Za-z0-9]{2,4}[-\s]?\d{3,6})\b"#
        if let codeRegex = try? NSRegularExpression(pattern: codePattern, options: []) {
            let nsString = line as NSString
            let matches = codeRegex.matches(in: line, options: [], range: NSRange(location: 0, length: nsString.length))
            for m in matches {
                var codeCandidate = nsString.substring(with: m.range).uppercased()
                codeCandidate = codeCandidate.replacingOccurrences(of: "^1F", with: "IF", options: .regularExpression)
                codeCandidate = codeCandidate.replacingOccurrences(of: "^1T", with: "IT", options: .regularExpression)
                if codeCandidate.range(of: #"^[A-Z]{2,4}[-\s]?\d{3,6}$"#, options: .regularExpression) != nil {
                    kodeMatkul = codeCandidate
                    break
                }
            }
        }

        // 4. Ekstraksi SKS (contoh: 3 SKS, 3sks, atau digit 1-8 di akhir)
        let sksPattern = #"\b([1-8])\s*sks\b"#
        if let sksRegex = try? NSRegularExpression(pattern: sksPattern, options: .caseInsensitive) {
            let nsString = line as NSString
            if let match = sksRegex.firstMatch(in: line, options: [], range: NSRange(location: 0, length: nsString.length)) {
                let digitStr = nsString.substring(with: match.range(at: 1))
                sks = Int(digitStr)
            }
        }
        if sks == nil, let lastToken = tokens.last, let digit = Int(lastToken), digit >= 1 && digit <= 8 {
            sks = digit
        }

        // 5. Ekstraksi Kelas (contoh: R.01, R.02, Kls A, 01, A)
        for token in tokens {
            if token.range(of: #"^(?:R\.?\d{2}|[A-Z]|\d{2})$"#, options: .regularExpression) != nil && token != hari && token != kodeMatkul && token.count <= 4 {
                kelas = token.uppercased()
                break
            }
        }

        // 6. Ekstraksi Ruangan / Lokasi (mengandung Lab, Ruang, R., Gedung)
        for token in tokens {
            if token.range(of: #"\b(?:Lab|Ruang|R\.\d+|Gedung|Online|Zoom|Auditorium)\b"#, options: [.regularExpression, .caseInsensitive]) != nil && lokasi == nil {
                lokasi = token
            }
        }

        // 7. Ekstraksi Dosen (mengandung gelar Dr., Prof., Ir., M.Kom, dll)
        if line.range(of: #"\b(?:Dr\.|Prof\.|Ir\.|M\.Kom|S\.T|M\.T|S\.Kom|Ph\.D)\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
            for token in tokens where token.contains("Dr.") || token.contains("Prof.") || token.contains("Ir.") || token.contains("M.") || token.contains("S.") {
                dosen = token
                break
            }
        }

        // 8. Pembersihan namaMatkul dari token-token metadata di atas
        var cleaned = line
        if let h = hari {
            cleaned = cleaned.replacingOccurrences(of: "\\b\(h)\\b", with: "", options: [.regularExpression, .caseInsensitive])
        }
        if let k = kodeMatkul {
            cleaned = cleaned.replacingOccurrences(of: "\\b\(k)\\b", with: "", options: [.regularExpression, .caseInsensitive])
        }
        if let timePatternMatch = line.range(of: timePattern, options: .regularExpression) {
            cleaned = cleaned.replacingCharacters(in: timePatternMatch, with: "")
        }
        if let s = sks {
            cleaned = cleaned.replacingOccurrences(of: "\\b\(s)\\s*sks\\b", with: "", options: [.regularExpression, .caseInsensitive])
            cleaned = cleaned.replacingOccurrences(of: "\\b\(s)\\b", with: "", options: .regularExpression)
        }
        cleaned = cleaned.replacingOccurrences(of: "\\bsks\\b", with: "", options: [.regularExpression, .caseInsensitive])
        if let kl = kelas {
            cleaned = cleaned.replacingOccurrences(of: "\\b\(kl)\\b", with: "", options: .regularExpression)
        }
        if let lok = lokasi {
            cleaned = cleaned.replacingOccurrences(of: lok, with: "")
        }

        // Bersihkan karakter khusus pembatas (| atau tab) dan spasi ganda
        cleaned = cleaned.replacingOccurrences(of: "[^a-zA-Z0-9\\s()\\-]", with: " ", options: .regularExpression)
        cleaned = cleaned.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)

        guard cleaned.count >= 2 else {
            return nil
        }

        // Validasi Logika Waktu
        var warnings: [String] = []
        var hasTimeError = false
        if let start = waktuMulai, let end = waktuSelesai {
            if start >= end {
                hasTimeError = true
                warnings.append("Waktu mulai (\(start)) tidak boleh lebih lambat dari waktu selesai (\(end)).")
            }
        } else {
            warnings.append("Waktu perkuliahan belum lengkap terdeteksi.")
        }

        if hari == nil {
            warnings.append("Hari perkuliahan belum terdeteksi.")
        }

        let needsReview = hasTimeError || hari == nil || waktuMulai == nil || waktuSelesai == nil

        return ImportScheduleItem(
            id: "local_\(rowIndex)_\(UUID().uuidString.prefix(6))",
            namaMatkul: cleaned,
            kodeMatkul: kodeMatkul,
            kelas: kelas,
            hari: hari ?? "",
            waktuMulai: waktuMulai ?? "",
            waktuSelesai: waktuSelesai ?? "",
            dosen: dosen,
            ruang: lokasi,
            lokasi: lokasi,
            sks: sks ?? 2,
            kategori: "Wajib",
            needsReview: needsReview,
            confidence: needsReview ? 0.65 : 0.95,
            recognitionStatus: needsReview ? "needs_review" : "high_confidence",
            fieldConfidence: [
                "namaMatkul": cleaned.count >= 3 ? 0.98 : 0.70,
                "hari": hari != nil ? 0.99 : 0.0,
                "waktuMulai": waktuMulai != nil && !hasTimeError ? 0.97 : 0.3,
                "waktuSelesai": waktuSelesai != nil && !hasTimeError ? 0.97 : 0.3
            ],
            reviewReasons: warnings.isEmpty ? nil : warnings,
            rawFields: [
                "rawText": line,
                "namaMatkul": cleaned,
                "hari": hari ?? "",
                "waktuMulai": waktuMulai ?? "",
                "waktuSelesai": waktuSelesai ?? ""
            ]
        )
    }

    private static func formatTime(_ raw: String) -> String {
        let clean = raw.replacingOccurrences(of: ".", with: ":").trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = clean.split(separator: ":")
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else {
            return raw
        }
        return String(format: "%02d:%02d", h, m)
    }
}
