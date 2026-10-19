import Foundation
import SwiftUI

/// ViewModel untuk mengelola proses pengunggahan dokumen jadwal (Foto/PDF),
/// ekstraksi OCR deterministik, fallback AI Vision dengan persetujuan eksplisit,
/// peninjauan serta pengeditan data per kolom, dan konfirmasi penyimpanan atomik.
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

    // MARK: - State Konfirmasi & Penyimpanan
    public var isConfirming: Bool = false
    public var learnCorrections: Bool = true
    public var isImportSuccess: Bool = false
    public var importedCount: Int = 0

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
    }

    public var isOffline: Bool {
        !NetworkMonitor.shared.isConnected
    }

    public var hasPreviewData: Bool {
        !items.isEmpty
    }

    public var visionEligible: Bool {
        guard !isDocumentPdf, selectedFileData != nil else { return false }
        if let prev = previewResponse {
            return prev.visionFallbackEligible
        }
        // If local OCR preview failed or returned empty items on an image, allow user to trigger Vision AI
        return errorMessage != nil && items.isEmpty
    }

    // MARK: - Pemilihan File
    public func handleFileSelected(data: Data, fileName: String, mimeType: String) {
        guard !isOffline else {
            errorMessage = "Perangkat sedang offline. Hubungkan ke internet untuk melakukan impor jadwal."
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
        self.isDocumentPdf = mimeType.lowercased().contains("pdf") || fileName.lowercased().hasSuffix(".pdf")
        self.errorMessage = nil
        self.items = []
        self.previewResponse = nil

        Task {
            await runOcrPreview()
        }
    }

    // MARK: - Ekstraksi OCR Preview
    public func runOcrPreview() async {
        guard let data = selectedFileData else {
            errorMessage = "Silakan pilih dokumen PDF atau gambar jadwal terlebih dahulu."
            return
        }

        guard !isOffline else {
            errorMessage = "Tidak dapat memproses jadwal saat offline."
            toast = FeedbackToastData(message: errorMessage!, severity: .warning)
            return
        }

        isLoading = true
        loadingMessage = isDocumentPdf ? "Membaca teks dari dokumen PDF..." : "Mengekstrak baris jadwal dengan OCR lokal..."
        errorMessage = nil

        do {
            let result = try await dataService.previewScheduleImport(
                fileData: data,
                fileName: selectedFileName.isEmpty ? "jadwal" : selectedFileName,
                mimeType: selectedFileMimeType.isEmpty ? (isDocumentPdf ? "application/pdf" : "image/jpeg") : selectedFileMimeType
            )

            self.previewResponse = result
            self.items = result.items
            self.isLoading = false

            if result.items.isEmpty {
                self.errorMessage = "Tidak ada jadwal yang berhasil dideteksi otomatis. Anda dapat mencoba bantuan Vision AI atau menambahkan mata kuliah secara manual."
            } else {
                let reviewCount = result.items.filter { $0.needsReview }.count
                if reviewCount > 0 {
                    toast = FeedbackToastData(
                        message: "Ditemukan \(result.items.count) mata kuliah (\(reviewCount) baris perlu ditinjau).",
                        severity: .warning
                    )
                } else {
                    toast = FeedbackToastData(
                        message: "Berhasil mendeteksi \(result.items.count) mata kuliah dengan akurasi tinggi!",
                        severity: .success
                    )
                }
            }
        } catch let err as AppError {
            self.isLoading = false
            self.errorMessage = err.errorDescription ?? "Gagal memproses dokumen jadwal."
            self.toast = FeedbackToastData(message: self.errorMessage!, severity: .error)
        } catch {
            self.isLoading = false
            self.errorMessage = error.localizedDescription
            self.toast = FeedbackToastData(message: error.localizedDescription, severity: .error)
        }
    }

    // MARK: - Fallback Vision AI
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

        // Encode current local items as context for merging
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

    // MARK: - Konfirmasi & Simpan Jadwal
    public func confirmAndSave(onSuccess: @escaping () -> Void) async {
        guard !items.isEmpty else {
            errorMessage = "Daftar mata kuliah kosong."
            return
        }

        // Validasi data inline sebelum dikirim ke server
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

        guard !isOffline else {
            errorMessage = "Tidak dapat menyimpan jadwal saat offline. Hubungkan ke internet terlebih dahulu."
            toast = FeedbackToastData(message: errorMessage!, severity: .warning)
            return
        }

        isConfirming = true
        errorMessage = nil

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
    }
}

