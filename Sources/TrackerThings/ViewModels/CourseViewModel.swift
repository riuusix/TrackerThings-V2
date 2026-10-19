import Foundation
import SwiftUI

@Observable
@MainActor
public final class CourseViewModel {
    public var courses: [JadwalItem] = []
    public var searchText: String = ""
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isPresentingSheet: Bool = false
    public var editingCourse: JadwalItem?
    public var deletingId: Int? = nil
    public var isSavingCourse: Bool = false
    public var currentLoadId: UUID = UUID()
    public var toast: FeedbackToastData?

    public func showToast(_ message: String, severity: FeedbackSeverity = .info) {
        self.toast = FeedbackToastData(message: message, severity: severity)
    }

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
    }

    public var filteredCourses: [JadwalItem] {
        if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            return courses
        }
        let term = searchText.lowercased()
        return courses.filter {
            $0.namaMatkul.lowercased().contains(term) ||
            ($0.dosen?.lowercased().contains(term) ?? false) ||
            $0.hari.lowercased().contains(term)
        }
    }

    public func fetchCourses() async {
        let loadId = UUID()
        currentLoadId = loadId
        isLoading = true
        errorMessage = nil

        defer {
            if currentLoadId == loadId {
                isLoading = false
            }
        }

        do {
            let loadedCourses = try await dataService.getJadwalList()
            guard currentLoadId == loadId else { return }
            courses = loadedCourses
        } catch {
            guard currentLoadId == loadId else { return }
            if error is CancellationError || (error as? AppError)?.isCancellation == true {
                return
            }
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            if !courses.isEmpty {
                showToast("Gagal memperbarui daftar kuliah. Menampilkan data tersimpan.", severity: .warning)
            }
        }
    }

    public var isOffline: Bool {
        !NetworkMonitor.shared.isConnected
    }

    public var lastCacheDateText: String? {
        if let date = LocalCacheService.shared.getCacheDate(forKey: LocalCacheService.keyJadwal) {
            let df = DateFormatter()
            df.locale = Locale(identifier: "id_ID")
            df.dateStyle = .short
            df.timeStyle = .short
            return "Sinkronisasi terakhir: \(df.string(from: date))"
        }
        return nil
    }

    public func saveCourse(
        namaMatkul: String,
        dosen: String?,
        kategori: String?,
        lokasi: String?,
        hari: String,
        waktuMulai: String,
        waktuSelesai: String
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyimpan mata kuliah saat offline. Hubungkan ke internet untuk menyinkronkan dengan server.", severity: .warning)
            return false
        }
        guard !isSavingCourse else { return false }
        isSavingCourse = true
        defer { isSavingCourse = false }

        isLoading = true
        errorMessage = nil

        let newItem = JadwalItem(
            id: editingCourse?.id ?? 0,
            namaMatkul: namaMatkul,
            dosen: dosen,
            kategori: kategori,
            lokasi: lokasi,
            hari: hari,
            waktuMulai: waktuMulai,
            waktuSelesai: waktuSelesai
        )

        do {
            if editingCourse != nil {
                _ = try await dataService.updateJadwal(newItem)
                showToast("Mata kuliah berhasil diperbarui!", severity: .success)
            } else {
                _ = try await dataService.createJadwal(newItem)
                showToast("Mata kuliah baru berhasil ditambahkan!", severity: .success)
            }
            await fetchCourses()
            await NotificationService.shared.syncRemindersFromCache()
            isPresentingSheet = false
            editingCourse = nil
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
    public func deleteCourse(id: Int) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menghapus mata kuliah saat offline.", severity: .warning)
            return false
        }
        guard deletingId == nil else { return false }
        deletingId = id
        defer { deletingId = nil }

        do {
            _ = try await dataService.deleteJadwal(id: id)
            courses.removeAll { $0.id == id }
            LocalCacheService.shared.save(courses, forKey: LocalCacheService.keyJadwal)
            NotificationService.shared.cancelReminderForCourse(id: id)
            await NotificationService.shared.syncRemindersFromCache()
            showToast("Mata kuliah berhasil dihapus.", severity: .success)
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }
}

