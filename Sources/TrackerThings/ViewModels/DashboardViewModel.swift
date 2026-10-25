import Foundation
import SwiftUI

@Observable
@MainActor
public final class DashboardViewModel {
    public var courses: [JadwalItem] = []
    public var urgentTasks: [TugasItem] = []
    public var completedTasks: [TugasItem] = []
    public var allExams: [UjianItem] = []
    public var upcomingExam: UjianItem?
    public var replacementClasses: [KelasPenggantiItem] = []
    public var academicSummary: AcademicIntelligenceSummary? = nil
    public var notifications: [NotificationItem] = []
    public var selectedDay: String = "Senin"
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var toast: FeedbackToastData?

    // MARK: - Editing State for Forms
    public var editingTask: TugasItem? = nil
    public var editingReplacement: KelasPenggantiItem? = nil

    // MARK: - In-Flight Request Guards & Race Condition Mitigation
    public private(set) var isSavingTask: Bool = false
    public private(set) var isSavingReplacement: Bool = false
    public private(set) var inFlightTaskIds: Set<Int> = []
    public private(set) var inFlightReplacementIds: Set<Int> = []
    private var currentLoadId: UUID = UUID()

    public func showToast(_ message: String, severity: FeedbackSeverity = .info) {
        self.toast = FeedbackToastData(message: message, severity: severity)
    }

    public var prioritizedInsights: [AcademicInsight] {
        academicSummary?.insights ?? []
    }

    public var dailyBriefing: DailyBriefing? {
        academicSummary?.briefing
    }

    public var scheduleConflicts: [ScheduleConflict] {
        academicSummary?.conflicts ?? []
    }

    public let daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

    private let dataService: TrackerDataServiceProtocol

    public init(dataService: TrackerDataServiceProtocol = TrackerDataService()) {
        self.dataService = dataService
        self.selectedDay = currentDayName()
    }

    public var schedulesForSelectedDay: [JadwalGabunganItem] {
        var items: [JadwalGabunganItem] = []

        // 1. Regular schedules on selected day
        for c in courses where c.hari.caseInsensitiveCompare(selectedDay) == .orderedSame {
            items.append(
                JadwalGabunganItem(
                    id: c.id,
                    idJadwal: c.id,
                    namaMatkul: c.namaMatkul,
                    dosen: c.dosen,
                    kategori: c.kategori,
                    lokasi: c.lokasi,
                    waktuMulai: c.waktuMulai,
                    waktuSelesai: c.waktuSelesai,
                    tipe: .reguler
                )
            )
        }

        // 2. Active replacement classes on selected day
        let calendar = Calendar.current
        for kp in replacementClasses where kp.status != "Selesai" {
            let dayIndex = calendar.component(.weekday, from: kp.tanggal)
            let dayName = indonesianDayName(fromWeekday: dayIndex)
            if dayName.caseInsensitiveCompare(selectedDay) == .orderedSame {
                items.append(
                    JadwalGabunganItem(
                        id: kp.id,
                        idJadwal: kp.idJadwal,
                        namaMatkul: kp.jadwal?.namaMatkul ?? "Kelas Pengganti",
                        kategori: kp.jadwal?.kategori,
                        lokasi: kp.lokasi,
                        waktuMulai: kp.waktuMulai,
                        waktuSelesai: kp.waktuSelesai,
                        tipe: .pengganti,
                        catatan: kp.catatan,
                        status: kp.status
                    )
                )
            }
        }

        return items.sorted { $0.waktuMulai < $1.waktuMulai }
    }

    public func loadDashboardData() async {
        let loadId = UUID()
        self.currentLoadId = loadId

        isLoading = true
        errorMessage = nil

        defer {
            if self.currentLoadId == loadId {
                self.isLoading = false
            }
        }

        do {
            async let fetchCourses = dataService.getJadwalList()
            async let fetchTasks = dataService.getTugasList()
            async let fetchExams = dataService.getUjianList()
            async let fetchKP = dataService.getKelasPenggantiList()

            let (loadedCourses, loadedTasks, loadedExams, loadedKP) = try await (
                fetchCourses,
                fetchTasks,
                fetchExams,
                fetchKP
            )

            // Race condition check: ensure newer request has not overtaken this one
            guard loadId == self.currentLoadId else { return }

            courses = loadedCourses
            urgentTasks = loadedTasks.filter { $0.status != .selesai }.sorted { $0.deadline < $1.deadline }
            completedTasks = loadedTasks.filter { $0.status == .selesai }.sorted { $0.deadline > $1.deadline }
            allExams = loadedExams.sorted { $0.tanggal < $1.tanggal }
            replacementClasses = loadedKP
            academicSummary = loadedIntelligence

            // Find closest upcoming exam
            let now = Date()
            upcomingExam = loadedExams
                .filter { $0.tanggal >= Calendar.current.startOfDay(for: now) }
                .sorted { $0.tanggal < $1.tanggal }
                .first

            // Build notifications for tasks due soon
            generateNotifications()

            // Sinkronkan seluruh pengingat lokal sistem (kuliah, tugas, ujian) secara deterministik
            await NotificationService.shared.syncAllReminders(
                courses: loadedCourses,
                tasks: loadedTasks,
                exams: loadedExams
            )
        } catch {
            guard loadId == self.currentLoadId else { return }
            if error is CancellationError || (error as? AppError)?.isCancellation == true {
                return
            }
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            // Jika sudah ada data lama (pull-to-refresh gagal), pertahankan data lama dan beri tahu user
            if !courses.isEmpty {
                showToast("Gagal memperbarui data terkini. Menampilkan data tersimpan.", severity: .warning)
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

    public func updateTaskProgress(task: TugasItem, progress: Int) async {
        guard !isOffline else {
            showToast("Tidak dapat memperbarui progress saat offline.", severity: .warning)
            return
        }

        guard !inFlightTaskIds.contains(task.id) else { return }
        inFlightTaskIds.insert(task.id)
        defer { inFlightTaskIds.remove(task.id) }

        do {
            _ = try await dataService.updateTugasProgress(id: task.id, progress: progress)
            if progress >= 100 {
                NotificationService.shared.cancelReminderForTask(id: task.id)
                showToast("Tugas \"\(task.namaTugas)\" selesai!", severity: .success)
            }
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
        }
    }

    public func saveTask(
        id: Int? = nil,
        namaTugas: String,
        idJadwal: Int,
        deadline: Date,
        prioritas: TugasItem.PrioritasTugas,
        jenis: TugasItem.JenisTugas,
        progress: Int? = nil,
        status: TugasItem.StatusTugas? = nil
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyimpan tugas saat offline. Hubungkan ke internet untuk menyimpan ke server.", severity: .warning)
            return false
        }

        guard !isSavingTask else { return false }
        isSavingTask = true
        defer { isSavingTask = false }

        let targetId = id ?? editingTask?.id

        do {
            if let existingId = targetId, existingId > 0 {
                let currentProgress = progress ?? editingTask?.progress ?? 0
                let resolvedStatus: TugasItem.StatusTugas = status ?? (
                    currentProgress >= 100
                        ? .selesai
                        : (currentProgress > 0 ? .sedangDikerjakan : .belumDikerjakan)
                )
                let updatedTask = TugasItem(
                    id: existingId,
                    idJadwal: idJadwal,
                    namaTugas: namaTugas,
                    deadline: deadline,
                    prioritas: prioritas,
                    jenis: jenis,
                    status: resolvedStatus,
                    progress: currentProgress
                )
                _ = try await dataService.updateTugas(updatedTask)
                editingTask = nil
                await loadDashboardData()
                showToast("Tugas berhasil diperbarui!", severity: .success)
                return true
            } else {
                let newTask = TugasItem(
                    id: 0,
                    idJadwal: idJadwal,
                    namaTugas: namaTugas,
                    deadline: deadline,
                    prioritas: prioritas,
                    jenis: jenis,
                    status: .belumDikerjakan,
                    progress: 0
                )
                _ = try await dataService.createTugas(newTask)
                editingTask = nil
                await loadDashboardData()
                showToast("Tugas baru berhasil ditambahkan!", severity: .success)
                return true
            }
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    @discardableResult
    public func deleteTask(id: Int) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menghapus tugas saat offline.", severity: .warning)
            return false
        }

        guard !inFlightTaskIds.contains(id) else { return false }
        inFlightTaskIds.insert(id)
        defer { inFlightTaskIds.remove(id) }

        do {
            _ = try await dataService.deleteTugas(id: id)
            NotificationService.shared.cancelReminderForTask(id: id)
            showToast("Tugas berhasil dihapus.", severity: .success)
            await loadDashboardData()
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    public func saveKelasPengganti(
        id: Int? = nil,
        idJadwal: Int,
        tanggal: Date,
        waktuMulai: String,
        waktuSelesai: String,
        lokasi: String?,
        catatan: String?,
        status: String? = nil
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyimpan kelas pengganti saat offline.", severity: .warning)
            return false
        }

        guard !isSavingReplacement else { return false }
        isSavingReplacement = true
        defer { isSavingReplacement = false }

        let targetId = id ?? editingReplacement?.id

        do {
            if let existingId = targetId, existingId > 0 {
                let resolvedStatus = status ?? editingReplacement?.status ?? "Belum Selesai"
                let updatedKP = KelasPenggantiItem(
                    id: existingId,
                    idJadwal: idJadwal,
                    tanggal: tanggal,
                    waktuMulai: waktuMulai,
                    waktuSelesai: waktuSelesai,
                    lokasi: lokasi,
                    catatan: catatan,
                    status: resolvedStatus
                )
                _ = try await dataService.updateKelasPengganti(updatedKP)
                editingReplacement = nil
                await loadDashboardData()
                showToast("Kelas pengganti berhasil diperbarui!", severity: .success)
                return true
            } else {
                let newKP = KelasPenggantiItem(
                    id: 0,
                    idJadwal: idJadwal,
                    tanggal: tanggal,
                    waktuMulai: waktuMulai,
                    waktuSelesai: waktuSelesai,
                    lokasi: lokasi,
                    catatan: catatan,
                    status: "Belum Selesai"
                )
                _ = try await dataService.createKelasPengganti(newKP)
                editingReplacement = nil
                await loadDashboardData()
                showToast("Kelas pengganti berhasil ditambahkan!", severity: .success)
                return true
            }
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    public func markReplacementCompleted(item: JadwalGabunganItem) async {
        guard item.tipe == .pengganti else { return }
        _ = await markReplacementCompletedById(item.id)
    }

    @discardableResult
    public func markReplacementCompletedById(_ id: Int) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat mengubah status saat offline.", severity: .warning)
            return false
        }

        guard !inFlightReplacementIds.contains(id) else { return false }
        inFlightReplacementIds.insert(id)
        defer { inFlightReplacementIds.remove(id) }

        do {
            _ = try await dataService.selesaiKelasPengganti(id: id)
            showToast("Kelas pengganti berhasil diselesaikan!", severity: .success)
            await loadDashboardData()
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    @discardableResult
    public func deleteKelasPengganti(id: Int) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menghapus kelas pengganti saat offline.", severity: .warning)
            return false
        }

        guard !inFlightReplacementIds.contains(id) else { return false }
        inFlightReplacementIds.insert(id)
        defer { inFlightReplacementIds.remove(id) }

        do {
            _ = try await dataService.deleteKelasPengganti(id: id)
            showToast("Kelas pengganti berhasil dihapus.", severity: .success)
            await loadDashboardData()
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    private func generateNotifications() {
        var notifs: [NotificationItem] = []
        let now = Date()
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: now)
        let twoDaysLaterEnd = calendar.date(byAdding: .day, value: 3, to: todayStart) ?? now

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "id_ID")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none

        for task in urgentTasks where task.deadline >= todayStart && task.deadline < twoDaysLaterEnd {
            notifs.append(
                NotificationItem(
                    id: "task-\(task.id)",
                    judul: task.namaTugas,
                    namaMatkul: task.jadwal?.namaMatkul ?? "Tugas Akademik",
                    waktu: formatter.string(from: task.deadline),
                    tipe: .tugas,
                    isUrgent: true
                )
            )
        }

        notifications = notifs
    }

    private func currentDayName() -> String {
        let weekday = Calendar.current.component(.weekday, from: Date())
        return indonesianDayName(fromWeekday: weekday)
    }

    private func indonesianDayName(fromWeekday weekday: Int) -> String {
        switch weekday {
        case 1: return "Minggu"
        case 2: return "Senin"
        case 3: return "Selasa"
        case 4: return "Rabu"
        case 5: return "Kamis"
        case 6: return "Jumat"
        case 7: return "Sabtu"
        default: return "Senin"
        }
    }
}

