import Foundation
import SwiftUI

/// ViewModel untuk mengelola proses pengunggahan dokumen jadwal (Foto/PDF),
/// ekstraksi OCR on-device (Apple Vision), parsing deterministik offline,
/// fallback AI Vision dengan persetujuan eksplisit, penyimpanan draf offline,
/// dan sinkronisasi atomik ke backend.
@Observable
@MainActor
public final class ImportScheduleViewModel {
    // MARK: - State File
    public var selectedFileData: Data? = nil
    public var selectedFileName: String = ""
    public var selectedFileMimeType: String = ""
    public var isDocumentPdf: Bool = false

    // MARK: - State Pemrosesan & UI
    public var isLoading: Bool = false
    public var loadingMessage: String = ""
    public var errorMessage: String? = nil
    public var toast: FeedbackToastData? = nil

    // MARK: - Data Hasil Ekstraksi
    public var previewResponse: ScheduleImportPreviewResponse? = nil
    public var items: [ImportScheduleItem] = []

    // MARK: - State AI Vision Fallback
    public var isVisionLoading: Bool = false
    public var showVisionConsentSheet: Bool = false

    // MARK: - State Konfirmasi & Draf Offline
    public var isConfirming: Bool = false
    public var learnCorrections: Bool = true
    public var isImportSuccess: Bool = false
    public var importedCount: Int = 0
    public var pendingDrafts: [OfflineScheduleDraft] = []
    public var isSyncingDrafts: Bool = false

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
        loadPendingDrafts()
    }

    public var isOffline: Bool {
        !NetworkMonitor.shared.isConnected
    }

    public var hasPreviewData: Bool {
        !items.isEmpty
    }

    public var visionEligible: Bool {
        guard !isDocumentPdf, selectedFileData != nil else { return false }
        if isOffline { return false } // Vision AI fallback requires network
        if let prev = previewResponse {
            return prev.visionFallbackEligible
        }
        return errorMessage != nil && items.isEmpty
    }

    // MARK: - Draf Offline Management
    public func loadPendingDrafts() {
        self.pendingDrafts = LocalCacheService.shared.loadScheduleDrafts()
    }

    public func deleteDraft(id: String) {
        LocalCacheService.shared.removeScheduleDraft(id: id)
        loadPendingDrafts()
    }

    public func syncDrafts() async {
        guard !isOffline else {
            toast = FeedbackToastData(message: "Perangkat masih offline. Hubungkan ke internet untuk menyinkronkan draf.", severity: .warning)
            return
        }
        guard !pendingDrafts.isEmpty else { return }

        isSyncingDrafts = true
        do {
            let responses = try await dataService.syncPendingScheduleDrafts()
            isSyncingDrafts = false
            loadPendingDrafts()
            let totalSynced = responses.reduce(0) { $0 + $1.count }
            toast = FeedbackToastData(message: "Berhasil menyinkronkan \(totalSynced) mata kuliah dari draf offline!", severity: .success)
        } catch {
            isSyncingDrafts = false
            loadPendingDrafts()
            toast = FeedbackToastData(message: "Gagal menyinkronkan sebagian draf: \(error.localizedDescription)", severity: .error)
        }
    }

    // MARK: - Pemilihan File
    public func handleFileSelected(data: Data, fileName: String, mimeType: String) {
        let isPdf = mimeType.lowercased().contains("pdf") || fileName.lowercased().hasSuffix(".pdf")

        // PDF digital table extraction requires backend server parser
        if isPdf && isOffline {
            errorMessage = "Impor PDF digital memerlukan koneksi internet untuk membaca struktur tabel server. Harap gunakan foto atau tangkapan layar jadwal untuk pemrosesan offline."
            toast = FeedbackToastData(message: errorMessage!, severity: .warning)
            return
        }

        guard data.count <= 10 * 1024 * 1024 else {
            errorMessage = "Ukuran file melebihi batas maksimal 10 MB."
            toast = FeedbackToastData(message: errorMessage!, severity: .error)
            return
        }

        self.selectedFileData = data
        self.selectedFileName = fileName
        self.selectedFileMimeType = mimeType
        self.isDocumentPdf = isPdf
        self.errorMessage = nil
        self.items = []
        self.previewResponse = nil

        Task {
            await runOcrPreview()
        }
    }

    // MARK: - Ekstraksi OCR Preview (Hybrid: On-Device Apple Vision + Online Bridge)
    public func runOcrPreview() async {
        guard let data = selectedFileData else {
            errorMessage = "Silakan pilih dokumen PDF atau gambar jadwal terlebih dahulu."
            return
        }

        isLoading = true
        errorMessage = nil

        if isDocumentPdf {
            // Jalur PDF: Memerlukan koneksi server
            guard !isOffline else {
                isLoading = false
                errorMessage = "Tidak dapat memproses dokumen PDF saat offline."
                toast = FeedbackToastData(message: errorMessage!, severity: .warning)
                return
            }

            loadingMessage = "Mengekstrak tabel dari dokumen PDF..."
            do {
                let result = try await dataService.previewScheduleImport(
                    fileData: data,
                    fileName: selectedFileName.isEmpty ? "jadwal.pdf" : selectedFileName,
                    mimeType: "application/pdf"
                )
                self.previewResponse = result
                self.items = result.items
                self.isLoading = false
                handleExtractionCompletion(result.items)
            } catch {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                self.toast = FeedbackToastData(message: error.localizedDescription, severity: .error)
            }
        } else {
            // Jalur Gambar: On-Device Apple Vision OCR terlebih dahulu (100% offline-ready)
            loadingMessage = "Mengekstrak teks dengan Apple Vision di perangkat..."

            let localOcrResult: LocalOcrResult?
            do {
                localOcrResult = try await AppleVisionOcrService.shared.recognizeText(from: data)
            } catch {
                localOcrResult = nil
            }

            let fullText = localOcrResult?.fullText ?? ""
            let words = localOcrResult?.words ?? []

            if !isOffline {
                // Online: Kirim evidence OCR lokal ke server untuk alignment spasial & kamus koreksi user
                loadingMessage = "Memetakan kolom tabel dan kamus preferensi akademik..."
                let wordsJson: String?
                if !words.isEmpty, let encoded = try? JSONEncoder().encode(words), let str = String(data: encoded, encoding: .utf8) {
                    wordsJson = str
                } else {
                    wordsJson = nil
                }

                do {
                    let result = try await dataService.previewScheduleImport(
                        fileData: data,
                        fileName: selectedFileName.isEmpty ? "jadwal_foto.jpg" : selectedFileName,
                        mimeType: selectedFileMimeType.isEmpty ? "image/jpeg" : selectedFileMimeType,
                        rawText: fullText.isEmpty ? nil : fullText,
                        ocrWordsJson: wordsJson
                    )
                    self.previewResponse = result
                    self.items = result.items
                    self.isLoading = false
                    handleExtractionCompletion(result.items)
                    return
                } catch {
                    // Jika server gagal, fallback transparan ke parser lokal tanpa crash
                }
            }

            // Jalur Offline atau Fallback Lokal dari Apple Vision OCR
            if let ocr = localOcrResult, !ocr.lines.isEmpty {
                let localParsedItems = LocalScheduleExtractor.extract(from: ocr)
                self.items = localParsedItems
                self.previewResponse = ScheduleImportPreviewResponse(
                    items: localParsedItems,
                    total: localParsedItems.count,
                    requiresReview: localParsedItems.contains { $0.needsReview },
                    layout: "apple_vision_offline",
                    insufficientForProduction: localParsedItems.isEmpty,
                    visionFallbackEligible: false,
                    filename: selectedFileName
                )
                self.isLoading = false

                if localParsedItems.isEmpty {
                    self.errorMessage = "Teks terdeteksi (\(ocr.lines.count) baris), namun kolom jadwal tidak dapat dipetakan secara otomatis. Anda dapat menambahkan baris secara manual."
                } else {
                    let reviewCount = localParsedItems.filter { $0.needsReview }.count
                    let msg = isOffline
                        ? "OCR Apple Vision offline selesai! Ditemukan \(localParsedItems.count) mata kuliah (\(reviewCount) baris perlu ditinjau)."
                        : "Ekstraksi lokal Apple Vision berhasil! Ditemukan \(localParsedItems.count) mata kuliah."
                    toast = FeedbackToastData(message: msg, severity: reviewCount > 0 ? .warning : .success)
                }
            } else {
                self.isLoading = false
                self.errorMessage = "Tidak ada teks yang dapat dikenali dari gambar. Pastikan gambar cukup terang dan tajam."
                self.toast = FeedbackToastData(message: self.errorMessage!, severity: .error)
            }
        }
    }

    private func handleExtractionCompletion(_ extractedItems: [ImportScheduleItem]) {
        if extractedItems.isEmpty {
            self.errorMessage = "Tidak ada jadwal yang berhasil dideteksi otomatis. Anda dapat mencoba bantuan Vision AI atau menambahkan mata kuliah secara manual."
        } else {
            let reviewCount = extractedItems.filter { $0.needsReview }.count
            if reviewCount > 0 {
                toast = FeedbackToastData(
                    message: "Ditemukan \(extractedItems.count) mata kuliah (\(reviewCount) baris perlu ditinjau).",
                    severity: .warning
                )
            } else {
                toast = FeedbackToastData(
                    message: "Berhasil mendeteksi \(extractedItems.count) mata kuliah dengan akurasi tinggi!",
                    severity: .success
                )
            }
        }
    }

    // MARK: - Fallback Vision AI (Strict Explicit Consent)
    public func runVisionAIFallback() async {
        guard let data = selectedFileData, !isDocumentPdf else {
            errorMessage = "Vision AI hanya mendukung input gambar (PNG/JPEG)."
            return
        }

        guard !isOffline else {
            errorMessage = "Koneksi internet diperlukan untuk bantuan Vision AI."
            toast = FeedbackToastData(message: errorMessage!, severity: .warning)
            return
        }

        isVisionLoading = true
        loadingMessage = "Menganalisis tata letak jadwal dengan Gemini Vision AI..."
        errorMessage = nil

        let localJsonString: String?
        if !items.isEmpty, let encoded = try? JSONEncoder().encode(items), let str = String(data: encoded, encoding: .utf8) {
            localJsonString = str
        } else {
            localJsonString = nil
        }

        do {
            let visionResult = try await dataService.visionScheduleImport(
                fileData: data,
                fileName: selectedFileName.isEmpty ? "jadwal_vision.jpg" : selectedFileName,
                mimeType: selectedFileMimeType.isEmpty ? "image/jpeg" : selectedFileMimeType,
                localItemsJson: localJsonString
            )

            self.previewResponse = visionResult
            self.items = visionResult.items
            self.isVisionLoading = false

            toast = FeedbackToastData(
                message: "Ekstraksi Vision AI selesai! Ditemukan \(visionResult.items.count) mata kuliah.",
                severity: .success
            )
        } catch let err as AppError {
            self.isVisionLoading = false
            self.errorMessage = err.errorDescription ?? "Gagal menghubungi Vision AI. Silakan tinjau dan edit manual hasil OCR yang ada."
            self.toast = FeedbackToastData(message: self.errorMessage!, severity: .error)
        } catch {
            self.isVisionLoading = false
            self.errorMessage = error.localizedDescription
            self.toast = FeedbackToastData(message: error.localizedDescription, severity: .error)
        }
    }

    // MARK: - Konfirmasi & Simpan Jadwal (Online Atomic Transaction atau Offline Draft)
    public func confirmAndSave(onSuccess: @escaping () -> Void) async {
        guard !items.isEmpty else {
            errorMessage = "Daftar mata kuliah kosong."
            return
        }

        // Validasi data inline per baris
        for (index, item) in items.enumerated() {
            let rowNum = index + 1
            let trimmedTitle = item.namaMatkul.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmedTitle.count < 2 {
                let msg = "Baris #\(rowNum): Nama mata kuliah wajib diisi minimal 2 karakter."
                self.errorMessage = msg
                self.toast = FeedbackToastData(message: msg, severity: .error)
                return
            }
            if item.hari.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let msg = "Baris #\(rowNum) (\(trimmedTitle)): Hari kuliah wajib dipilih."
                self.errorMessage = msg
                self.toast = FeedbackToastData(message: msg, severity: .error)
                return
            }
            if item.waktuMulai.isEmpty || item.waktuSelesai.isEmpty {
                let msg = "Baris #\(rowNum) (\(trimmedTitle)): Jam mulai dan selesai wajib diisi."
                self.errorMessage = msg
                self.toast = FeedbackToastData(message: msg, severity: .error)
                return
            }
        }

        isConfirming = true
        errorMessage = nil

        if isOffline {
            // Simpan draf offline secara persisten
            let draft = OfflineScheduleDraft(
                fileName: selectedFileName.isEmpty ? "jadwal_offline.jpg" : selectedFileName,
                items: items,
                status: .pendingSync
            )
            LocalCacheService.shared.saveScheduleDraft(draft)
            loadPendingDrafts()

            self.isConfirming = false
            self.importedCount = items.count
            self.isImportSuccess = true

            toast = FeedbackToastData(
                message: "Jadwal berhasil disimpan sebagai draf offline! Akan disinkronkan ke server saat terhubung kembali.",
                severity: .info
            )
            onSuccess()
        } else {
            // Simpan langsung ke server backend
            do {
                let response = try await dataService.confirmScheduleImport(
                    items: items,
                    learnCorrections: learnCorrections
                )

                self.isConfirming = false
                self.importedCount = response.count
                self.isImportSuccess = true

                toast = FeedbackToastData(
                    message: "Berhasil mengimpor \(response.count) mata kuliah ke jadwal Anda!",
                    severity: .success
                )

                onSuccess()
            } catch let err as AppError {
                self.isConfirming = false
                self.errorMessage = err.errorDescription ?? "Gagal menyimpan jadwal ke database."
                self.toast = FeedbackToastData(message: self.errorMessage!, severity: .error)
            } catch {
                self.isConfirming = false
                self.errorMessage = error.localizedDescription
                self.toast = FeedbackToastData(message: error.localizedDescription, severity: .error)
            }
        }
    }

    // MARK: - Manipulasi Baris
    public func removeItem(id: String) {
        items.removeAll { $0.id == id }
    }

    public func addNewRow() {
        let newItem = ImportScheduleItem(
            id: UUID().uuidString,
            namaMatkul: "",
            kodeMatkul: nil,
            kelas: nil,
            hari: "Senin",
            waktuMulai: "08:00",
            waktuSelesai: "10:00",
            dosen: nil,
            ruang: nil,
            lokasi: nil,
            sks: 2,
            kategori: "Wajib",
            needsReview: false,
            confidence: 1.0,
            recognitionStatus: "manual_entry",
            reviewReasons: nil
        )
        items.append(newItem)
    }

    public func reset() {
        selectedFileData = nil
        selectedFileName = ""
        selectedFileMimeType = ""
        isDocumentPdf = false
        items = []
        previewResponse = nil
        isLoading = false
        isVisionLoading = false
        isConfirming = false
        errorMessage = nil
        isImportSuccess = false
        importedCount = 0
        loadPendingDrafts()
    }
}
