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
    public static let serverRefinementStatusMessage = "Kami sedang memproses pertajaman analisismu, tunggu sebentar."

    public var isLoading: Bool = false
    public var activeEngine: ScheduleImportEngine = .localAppleVision
    public var loadingMessage: String = ""
    public var errorMessage: String? = nil
    public var toast: FeedbackToastData? = nil
    private var previewTask: Task<Void, Never>? = nil

    // MARK: - Data Hasil Ekstraksi
    public var previewResponse: ScheduleImportPreviewResponse? = nil
    public var items: [ImportScheduleItem] = []

    // MARK: - State AI Vision Fallback
    public var isVisionLoading: Bool = false
    public var showVisionConsentSheet: Bool = false
    public var serverVisionFallbackEligible: Bool = false

    // MARK: - State Server Draft Lifecycle
    public var currentDraftId: String? = nil
    public var currentDraftVersion: Int = 1

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
        guard selectedFileData != nil else { return false }
        if isOffline { return false } // Vision AI fallback requires network
        if serverVisionFallbackEligible { return true }
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

        previewTask?.cancel()
        previewTask = Task {
            await runOcrPreview()
        }
    }

    public func cancelProcessing() {
        previewTask?.cancel()
        previewTask = nil
        isLoading = false
        isVisionLoading = false
        activeEngine = .localAppleVision
        loadingMessage = ""
    }

    // MARK: - Ekstraksi OCR Preview (Hybrid: On-Device Apple Vision + Central Server Fallback)
    public func runOcrPreview() async {
        guard let data = selectedFileData else {
            errorMessage = "Silakan pilih dokumen PDF atau gambar jadwal terlebih dahulu."
            return
        }

        isLoading = true
        errorMessage = nil
        serverVisionFallbackEligible = false

        if isDocumentPdf {
            // Jalur PDF: Memerlukan pemrosesan hybrid di server
            guard !isOffline else {
                isLoading = false
                errorMessage = "Tidak dapat memproses dokumen PDF saat offline."
                toast = FeedbackToastData(message: errorMessage!, severity: .warning)
                return
            }

            activeEngine = .serverInternet
            loadingMessage = ScheduleImportEngine.serverInternet.statusMessage
            do {
                let result = try await dataService.previewScheduleImport(
                    fileData: data,
                    fileName: selectedFileName.isEmpty ? "jadwal.pdf" : selectedFileName,
                    mimeType: "application/pdf"
                )
                guard !Task.isCancelled else { return }
                if result.engineUsed == "python_pdfplumber" || result.processingStage == "python_refinement" {
                    self.activeEngine = .python
                } else {
                    self.activeEngine = .typescript
                }
                self.currentDraftId = result.draftId
                self.currentDraftVersion = result.draftVersion ?? 1
                self.serverVisionFallbackEligible = result.visionFallbackEligible
                self.previewResponse = result
                self.items = result.items
                self.isLoading = false
                handleExtractionCompletion(result.items)
            } catch {
                guard !Task.isCancelled else { return }
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                self.toast = FeedbackToastData(message: error.localizedDescription, severity: .warning)
                // Tangani respons HTTP 422 (EMPTY_SCHEDULE_EXTRACTED / SCANNED_PDF_NO_TEXT)
                if let appError = error as? AppError, appError.statusCode == 422 {
                    self.serverVisionFallbackEligible = true
                }
            }
        } else {
            // Jalur Gambar: 1. On-Device Apple Vision OCR terlebih dahulu (Local-First)
            activeEngine = .localAppleVision
            loadingMessage = ScheduleImportEngine.localAppleVision.statusMessage

            let localOcrResult: LocalOcrResult?
            do {
                localOcrResult = try await AppleVisionOcrService.shared.recognizeText(from: data)
            } catch {
                localOcrResult = nil
            }
            guard !Task.isCancelled else { return }

            let fullText = localOcrResult?.fullText ?? ""
            let words = localOcrResult?.words ?? []
            let localParsedItems: [ImportScheduleItem]
            if let ocr = localOcrResult, !ocr.lines.isEmpty {
                localParsedItems = LocalScheduleExtractor.extract(from: ocr)
            } else {
                localParsedItems = []
            }

            // Quality gate lokal: apakah hasil ekstraksi di perangkat sudah lengkap & bebas needsReview?
            let isLocallySufficient = !localParsedItems.isEmpty && !localParsedItems.contains { $0.needsReview }

            // 2. Jika hasil lokal sudah valid & lengkap, langsung lanjut ke pratinjau tanpa unggah ke server
            if isLocallySufficient {
                self.items = localParsedItems
                self.previewResponse = ScheduleImportPreviewResponse(
                    items: localParsedItems,
                    total: localParsedItems.count,
                    requiresReview: false,
                    layout: "apple_vision_local",
                    insufficientForProduction: false,
                    visionFallbackEligible: false,
                    filename: selectedFileName,
                    engineUsed: "apple_vision_local",
                    processingStage: "ocr_extraction",
                    qualityStatus: "sufficient",
                    warnings: []
                )
                self.isLoading = false
                toast = FeedbackToastData(
                    message: "Ekstraksi lokal Apple Vision berhasil! Ditemukan \(localParsedItems.count) mata kuliah.",
                    severity: .success
                )
                return
            }

            // 3. Jika hasil lokal kosong, belum lengkap, atau gagal quality gate, dan perangkat online:
            // Tampilkan status pertajaman analisis & unggah dokumen beserta bukti OCR ke server hybrid
            if !isOffline {
                activeEngine = .serverInternet
                loadingMessage = Self.serverRefinementStatusMessage
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
                    guard !Task.isCancelled else { return }
                    if result.engineUsed == "python_pdfplumber" || result.processingStage == "python_refinement" {
                        self.activeEngine = .python
                    } else {
                        self.activeEngine = .typescript
                    }
                    self.currentDraftId = result.draftId
                    self.currentDraftVersion = result.draftVersion ?? 1
                    self.serverVisionFallbackEligible = result.visionFallbackEligible
                    self.previewResponse = result
                    self.items = result.items
                    self.isLoading = false
                    handleExtractionCompletion(result.items)
                    return
                } catch {
                    guard !Task.isCancelled else { return }
                    if let appError = error as? AppError, appError.statusCode == 422 {
                        self.serverVisionFallbackEligible = true
                    }
                    // Jika server tidak dapat dihubungi atau error, pertahankan hasil OCR Apple Vision lokal untuk ditinjau manual
                    if !localParsedItems.isEmpty {
                        self.items = localParsedItems
                        self.previewResponse = ScheduleImportPreviewResponse(
                            items: localParsedItems,
                            total: localParsedItems.count,
                            requiresReview: true,
                            layout: "apple_vision_offline",
                            insufficientForProduction: true,
                            visionFallbackEligible: true,
                            filename: selectedFileName,
                            engineUsed: "apple_vision_local",
                            processingStage: "ocr_extraction",
                            qualityStatus: "needs_review",
                            warnings: ["Layanan server tidak dapat dijangkau. Menampilkan hasil OCR lokal untuk ditinjau manual."]
                        )
                        self.isLoading = false
                        self.toast = FeedbackToastData(
                            message: "Server tidak terjangkau. Menampilkan \(localParsedItems.count) mata kuliah hasil OCR lokal untuk ditinjau manual.",
                            severity: .warning
                        )
                        return
                    } else {
                        self.isLoading = false
                        self.errorMessage = error.localizedDescription
                        self.toast = FeedbackToastData(message: error.localizedDescription, severity: .warning)
                        return
                    }
                }
            }

            // 3. Jalur Offline-First: Ekstraksi on-device menggunakan Apple Vision OCR
            if let ocr = localOcrResult, !ocr.lines.isEmpty {
                self.items = localParsedItems
                self.previewResponse = ScheduleImportPreviewResponse(
                    items: localParsedItems,
                    total: localParsedItems.count,
                    requiresReview: localParsedItems.contains { $0.needsReview },
                    layout: "apple_vision_offline",
                    insufficientForProduction: localParsedItems.isEmpty,
                    visionFallbackEligible: localParsedItems.isEmpty || localParsedItems.contains { $0.needsReview },
                    filename: selectedFileName,
                    engineUsed: "apple_vision_local",
                    processingStage: "ocr_extraction",
                    qualityStatus: localParsedItems.isEmpty ? "empty" : (localParsedItems.contains { $0.needsReview } ? "needs_review" : "sufficient"),
                    warnings: localParsedItems.isEmpty ? ["Kolom tabel jadwal belum dapat dipetakan secara otomatis."] : []
                )
                self.isLoading = false

                if localParsedItems.isEmpty {
                    self.errorMessage = "Teks terdeteksi (\(ocr.lines.count) baris), namun kolom jadwal tidak dapat dipetakan secara otomatis. Anda dapat mencoba bantuan Vision AI saat online atau menambahkan baris secara manual."
                } else {
                    let reviewCount = localParsedItems.filter { $0.needsReview }.count
                    let msg = "OCR Apple Vision offline selesai! Ditemukan \(localParsedItems.count) mata kuliah (\(reviewCount) baris perlu ditinjau)."
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
        guard let data = selectedFileData else {
            errorMessage = "Silakan pilih dokumen PDF atau gambar jadwal terlebih dahulu."
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
            let isPdf = isDocumentPdf
            let fallbackName = isPdf ? "jadwal_vision.pdf" : "jadwal_vision.jpg"
            let fallbackMime = isPdf ? "application/pdf" : "image/jpeg"
            let visionResult = try await dataService.visionScheduleImport(
                fileData: data,
                fileName: selectedFileName.isEmpty ? fallbackName : selectedFileName,
                mimeType: selectedFileMimeType.isEmpty ? fallbackMime : selectedFileMimeType,
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
        previewTask?.cancel()
        previewTask = nil
        selectedFileData = nil
        selectedFileName = ""
        selectedFileMimeType = ""
        isDocumentPdf = false
        items = []
        previewResponse = nil
        currentDraftId = nil
        currentDraftVersion = 1
        isLoading = false
        isVisionLoading = false
        isConfirming = false
        errorMessage = nil
        isImportSuccess = false
        importedCount = 0
        loadPendingDrafts()
    }
}

public typealias ScheduleImportViewModel = ImportScheduleViewModel

