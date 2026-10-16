import Foundation
import SwiftUI

@Observable
@MainActor
public final class ExamViewModel {
    public var exams: [UjianItem] = []
    public var courses: [JadwalItem] = []
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isPresentingSheet: Bool = false
    public var editingExam: UjianItem?
    public var deletingId: Int? = nil
    public var isSavingExam: Bool = false
    public var currentLoadId: UUID = UUID()
    public var toast: FeedbackToastData?

    public func showToast(_ message: String, severity: FeedbackSeverity = .info) {
        self.toast = FeedbackToastData(message: message, severity: severity)
    }

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
    }

    public func fetchExams() async {
        let loadId = UUID()
        currentLoadId = loadId
        isLoading = true
        errorMessage = nil

        do {
            async let examTask = dataService.getUjianList()
            async let courseTask = dataService.getJadwalList()
            let (loadedExams, loadedCourses) = try await (examTask, courseTask)
            guard currentLoadId == loadId else { return }
            exams = loadedExams.sorted { $0.tanggal < $1.tanggal }
            courses = loadedCourses
            isLoading = false
        } catch {
            guard currentLoadId == loadId else { return }
            errorMessage = error.localizedDescription
            isLoading = false
            if !exams.isEmpty {
                showToast("Gagal memperbarui jadwal ujian. Menampilkan data tersimpan.", severity: .warning)
            }
        }
    }

    public var isOffline: Bool {
        !NetworkMonitor.shared.isConnected
    }

    public var lastCacheDateText: String? {
        if let date = LocalCacheService.shared.getCacheDate(forKey: LocalCacheService.keyUjian) {
            let df = DateFormatter()
            df.locale = Locale(identifier: "id_ID")
            df.dateStyle = .short
            df.timeStyle = .short
            return "Sinkronisasi terakhir: \(df.string(from: date))"
        }
        return nil
    }

    public func saveExam(
        idJadwal: Int,
        jenisUjian: String,
        tanggal: Date,
        waktuMulai: String?,
        waktuSelesai: String?,
        ruangan: String?,
        catatan: String?
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyimpan jadwal ujian saat offline. Hubungkan ke internet untuk menyinkronkan dengan server.", severity: .warning)
            return false
        }
        guard !isSavingExam else { return false }
        isSavingExam = true
        defer { isSavingExam = false }

        isLoading = true
        errorMessage = nil

        let item = UjianItem(
            id: editingExam?.id ?? 0,
            idJadwal: idJadwal,
            jenisUjian: jenisUjian,
            tanggal: tanggal,
            waktuMulai: waktuMulai,
            waktuSelesai: waktuSelesai,
            ruangan: ruangan,
            catatan: catatan
        )

        do {
            if editingExam != nil {
                _ = try await dataService.updateUjian(item)
                showToast("Jadwal ujian berhasil diperbarui!", severity: .success)
            } else {
                _ = try await dataService.createUjian(item)
                showToast("Jadwal ujian baru berhasil ditambahkan!", severity: .success)
            }
            await fetchExams()
            await NotificationService.shared.syncRemindersFromCache()
            isPresentingSheet = false
            editingExam = nil
            isLoading = false
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            isLoading = false
            return false
        }
    }

    @discardableResult
    public func deleteExam(id: Int) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menghapus jadwal ujian saat offline.", severity: .warning)
            return false
        }
        guard deletingId == nil else { return false }
        deletingId = id
        defer { deletingId = nil }

        do {
            _ = try await dataService.deleteUjian(id: id)
            exams.removeAll { $0.id == id }
            LocalCacheService.shared.save(exams, forKey: LocalCacheService.keyUjian)
            NotificationService.shared.cancelReminderForExam(id: id)
            await NotificationService.shared.syncRemindersFromCache()
            showToast("Jadwal ujian berhasil dihapus.", severity: .success)
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }
}

