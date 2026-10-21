import Foundation
import Vision
#if canImport(UIKit)
import UIKit
#endif

/// Hasil ekstraksi OCR lokal menggunakan Apple Vision framework
public struct LocalOcrResult: Sendable {
    public let fullText: String
    public let lines: [String]
    public let words: [OcrWord]
    public let averageConfidence: Double
    public let durationMs: Double

    public init(
        fullText: String,
        lines: [String],
        words: [OcrWord],
        averageConfidence: Double,
        durationMs: Double
    ) {
        self.fullText = fullText
        self.lines = lines
        self.words = words
        self.averageConfidence = averageConfidence
        self.durationMs = durationMs
    }
}

/// Service aktor untuk menjalankan OCR on-device berbasis Vision framework secara asynchronous dan terisolasi dari MainActor
public actor AppleVisionOcrService {
    public static let shared = AppleVisionOcrService()

    public init() {}

    /// Mengekstrak teks dari data gambar menggunakan Apple Vision VNRecognizeTextRequest (100% on-device).
    /// Mengembalikan token kata, koordinat bounding box ternormalisasi (0.0 ... 1.0, top-left),
    /// dan tingkat keyakinan (confidence).
    public func recognizeText(from imageData: Data) async throws -> LocalOcrResult {
        let startTime = CFAbsoluteTimeGetCurrent()

        guard !imageData.isEmpty else {
            return LocalOcrResult(fullText: "", lines: [], words: [], averageConfidence: 0.0, durationMs: 0.0)
        }

        return try await withCheckedThrowingContinuation { continuation in
            let requestHandler = VNImageRequestHandler(data: imageData, options: [:])
            let request = VNRecognizeTextRequest { request, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let observations = request.results as? [VNRecognizedTextObservation], !observations.isEmpty else {
                    let elapsed = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
                    continuation.resume(returning: LocalOcrResult(
                        fullText: "",
                        lines: [],
                        words: [],
                        averageConfidence: 0.0,
                        durationMs: elapsed
                    ))
                    return
                }

                // Urutkan observasi dari atas ke bawah (Top-to-Bottom, Left-to-Right)
                // Di Vision framework, Y=0 berada di bawah (bottom-left). Kita balik menjadi Y=0 di atas (top-left).
                let sortedObservations = observations.sorted { obs1, obs2 in
                    let y1 = 1.0 - obs1.boundingBox.midY
                    let y2 = 1.0 - obs2.boundingBox.midY
                    if abs(y1 - y2) > 0.015 {
                        return y1 < y2
                    }
                    return obs1.boundingBox.minX < obs2.boundingBox.minX
                }

                var recognizedWords: [OcrWord] = []
                var recognizedLines: [String] = []
                var totalConfidence: Double = 0.0
                var wordCount = 0

                for obs in sortedObservations {
                    guard let topCandidate = obs.topCandidates(1).first else { continue }
                    let text = topCandidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !text.isEmpty else { continue }

                    let conf = Double(topCandidate.confidence)
                    totalConfidence += conf
                    wordCount += 1

                    // Konversi koordinat Vision (bottom-left origin) ke standard top-left origin
                    let box = obs.boundingBox
                    let x0 = Double(box.minX)
                    let x1 = Double(box.maxX)
                    let y0 = Double(1.0 - box.maxY)
                    let y1 = Double(1.0 - box.minY)

                    let ocrBbox = OcrBoundingBox(x0: x0, y0: y0, x1: x1, y1: y1)
                    recognizedWords.append(OcrWord(text: text, confidence: conf, bbox: ocrBbox))
                    recognizedLines.append(text)
                }

                let avgConf = wordCount > 0 ? (totalConfidence / Double(wordCount)) : 0.0
                let fullText = recognizedLines.joined(separator: "\n")
                let elapsed = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0

                continuation.resume(returning: LocalOcrResult(
                    fullText: fullText,
                    lines: recognizedLines,
                    words: recognizedWords,
                    averageConfidence: avgConf,
                    durationMs: elapsed
                ))
            }

            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            // Verifikasi dukungan bahasa secara dinamis pada OS yang berjalan
            if let supported = try? VNRecognizeTextRequest.supportedRecognitionLanguages(for: .accurate, revision: request.revision) {
                var selectedLangs: [String] = []
                if supported.contains(where: { $0.lowercased().hasPrefix("id") }) {
                    selectedLangs.append("id-ID")
                }
                if supported.contains(where: { $0.lowercased().hasPrefix("en") }) {
                    selectedLangs.append("en-US")
                }
                if !selectedLangs.isEmpty {
                    request.recognitionLanguages = selectedLangs
                } else {
                    request.recognitionLanguages = supported
                }
            } else {
                request.recognitionLanguages = ["en-US"]
            }

            do {
                try requestHandler.perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
