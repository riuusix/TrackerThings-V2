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
    public var reminderEditingTask: TugasItem? = nil

    // MARK: - Pinned vs Unpinned Active Tasks (Single-Representation Contract)
    /// Tugas aktif yang disematkan pengguna, diurutkan berdasarkan tenggat terdekat lalu bobot prioritas.
    public var pinnedTasks: [TugasItem] {
        Self.sortActiveTasks(urgentTasks.filter { $0.isPinned })
    }

    /// Tugas aktif yang tidak disematkan, dijamin tidak pernah menduplikasi tugas di `pinnedTasks`.
    public var unpinnedUrgentTasks: [TugasItem] {
        let pinnedIds = Set(pinnedTasks.map { $0.id })
        return Self.sortActiveTasks(urgentTasks.filter { !$0.isPinned && !pinnedIds.contains($0.id) })
    }

    public nonisolated static func sortActiveTasks(_ tasks: [TugasItem]) -> [TugasItem] {
        tasks.sorted { lhs, rhs in
            if lhs.deadline != rhs.deadline {
                return lhs.deadline < rhs.deadline
            }
            if lhs.prioritas.sortWeight != rhs.prioritas.sortWeight {
                return lhs.prioritas.sortWeight < rhs.prioritas.sortWeight
            }
            return lhs.id < rhs.id
        }
    }

    /// Validasi bersama rentang waktu mulai dan selesai (`HH:mm`) untuk Quick Composer dan Form Sheet.
    public nonisolated static func isValidTimeRange(start: String, end: String) -> Bool {
        let s = start.trimmingCharacters(in: .whitespacesAndNewlines)
        let e = end.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty, !e.isEmpty else { return false }
        return s < e
    }

    // MARK: - Task Completion Undo State
    public var recentlyCompletedTask: TugasItem? = nil
    public private(set) var previousCompletedTaskProgress: Int = 0
    private var undoCompletionTimer: Task<Void, Never>? = nil

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
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "yyyy-MM-dd"
            dateFormatter.locale = Locale(identifier: "en_US_POSIX")
            dateFormatter.timeZone = TimeZone.current
            let refDate = dateFormatter.string(from: Date())
            let tz = TimeZone.current.identifier

            async let fetchCourses = dataService.getJadwalList()
            async let fetchTasks = dataService.getTugasList()
            async let fetchExams = dataService.getUjianList()
            async let fetchKP = dataService.getKelasPenggantiList()
            async let fetchIntelligence: AcademicIntelligenceSummary? = {
                do {
                    return try await dataService.getAcademicInsights(referenceDate: refDate, timezone: tz, upcomingWindowDays: 7)
                } catch {
                    return nil
                }
            }()

            let (loadedCourses, loadedTasks, loadedExams, loadedKP, loadedIntelligence) = try await (
                fetchCourses,
                fetchTasks,
                fetchExams,
                fetchKP,
                fetchIntelligence
            )

            // Race condition check: ensure newer request has not overtaken this one
            guard loadId == self.currentLoadId else { return }

            courses = loadedCourses
            urgentTasks = Self.sortActiveTasks(loadedTasks.filter { $0.status != .selesai })
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

            // Sinkronkan seluruh pengingat lokal sistem (kuliah, tugas, ujian, kelas pengganti) secara deterministik
            await NotificationService.shared.syncAllReminders(
                courses: loadedCourses,
                tasks: loadedTasks,
                exams: loadedExams,
                replacementClasses: loadedKP
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
            let wasIncomplete = task.progress < 100 && task.status != .selesai
            let previousProgress = task.progress
            _ = try await dataService.updateTugasProgress(id: task.id, progress: progress)
            if progress >= 100 {
                NotificationService.shared.cancelReminderForTask(id: task.id)
                if wasIncomplete {
                    registerCompletionUndo(for: task, previousProgress: previousProgress)
                } else {
                    showToast("Tugas \"\(task.namaTugas)\" selesai!", severity: .success)
                }
            } else if recentlyCompletedTask?.id == task.id {
                clearCompletionUndo()
            }
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
        }
    }

    private func registerCompletionUndo(for task: TugasItem, previousProgress: Int) {
        undoCompletionTimer?.cancel()
        withAnimation(AppTheme.Motion.taskCompletion) {
            self.recentlyCompletedTask = task
            self.previousCompletedTaskProgress = max(0, min(90, previousProgress))
        }
        undoCompletionTimer = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 6_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(AppTheme.Motion.panelDismiss) {
                self?.recentlyCompletedTask = nil
            }
        }
    }

    public func clearCompletionUndo() {
        undoCompletionTimer?.cancel()
        undoCompletionTimer = nil
        withAnimation(AppTheme.Motion.panelDismiss) {
            recentlyCompletedTask = nil
        }
    }

    public func undoRecentTaskCompletion() async {
        guard let task = recentlyCompletedTask else { return }
        let targetProgress = previousCompletedTaskProgress
        clearCompletionUndo()
        HapticsHelper.impactLight()
        await updateTaskProgress(task: task, progress: targetProgress)
        showToast("Penyelesaian tugas \"\(task.namaTugas)\" diurungkan.", severity: .info)
    }

    @discardableResult
    public func toggleTaskPin(task: TugasItem) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyematkan tugas saat offline.", severity: .warning)
            return false
        }

        guard !inFlightTaskIds.contains(task.id) else { return false }
        inFlightTaskIds.insert(task.id)
        defer { inFlightTaskIds.remove(task.id) }

        let targetPinState = !task.isPinned
        let previousUrgent = urgentTasks

        withAnimation(AppTheme.Motion.pinCommit) {
            if let idx = urgentTasks.firstIndex(where: { $0.id == task.id }) {
                urgentTasks[idx].isPinned = targetPinState
            }
            urgentTasks = Self.sortActiveTasks(urgentTasks)
        }

        do {
            _ = try await dataService.updateTugasPin(id: task.id, isPinned: targetPinState)
            showToast(
                targetPinState
                    ? "Tugas \"\(task.namaTugas)\" disematkan."
                    : "Sematan tugas \"\(task.namaTugas)\" dilepas.",
                severity: .info
            )
            return true
        } catch {
            withAnimation(AppTheme.Motion.pinCommit) {
                urgentTasks = previousUrgent
            }
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    @discardableResult
    public func updateTaskCustomReminder(task: TugasItem, reminderAt: Date?) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menyimpan pengingat saat offline.", severity: .warning)
            return false
        }

        if let reminderAt {
            guard NotificationService.isValidCustomReminder(reminderAt: reminderAt, deadline: task.deadline) else {
                showToast("Waktu pengingat harus di masa depan dan sebelum tenggat tugas.", severity: .warning)
                return false
            }
        }

        guard !inFlightTaskIds.contains(task.id) else { return false }
        inFlightTaskIds.insert(task.id)
        defer { inFlightTaskIds.remove(task.id) }

        let previousUrgent = urgentTasks

        withAnimation(AppTheme.Motion.reminderConfirm) {
            if let idx = urgentTasks.firstIndex(where: { $0.id == task.id }) {
                urgentTasks[idx].reminderAt = reminderAt
            }
        }

        do {
            _ = try await dataService.updateTugasReminder(id: task.id, reminderAt: reminderAt)
            if let reminderAt {
                let courseName = courses.first(where: { $0.id == task.idJadwal })?.namaMatkul ?? task.jadwal?.namaMatkul
                _ = await NotificationService.shared.scheduleCustomReminderForTask(
                    id: task.id,
                    title: task.namaTugas,
                    courseName: courseName,
                    deadline: task.deadline,
                    reminderAt: reminderAt
                )
                let df = DateFormatter()
                df.locale = Locale(identifier: "id_ID")
                df.dateStyle = .medium
                df.timeStyle = .short
                showToast("Pengingat diatur untuk \(df.string(from: reminderAt)).", severity: .success)
            } else {
                NotificationService.shared.cancelCustomReminderForTask(id: task.id)
                showToast("Pengingat kustom tugas dihapus.", severity: .info)
            }
            return true
        } catch {
            withAnimation(AppTheme.Motion.reminderConfirm) {
                urgentTasks = previousUrgent
            }
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
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
                let existingItem = urgentTasks.first(where: { $0.id == existingId }) ?? completedTasks.first(where: { $0.id == existingId }) ?? editingTask
                let currentProgress = progress ?? existingItem?.progress ?? 0
                let resolvedStatus: TugasItem.StatusTugas = status ?? (
                    currentProgress >= 100
                        ? .selesai
                        : (currentProgress > 0 ? .sedangDikerjakan : .belumDikerjakan)
                )
                let existingPinned = existingItem?.isPinned ?? false
                // Jika deadline berubah sehingga pengingat kustom lama melewati tenggat baru, bersihkan pengingat kustom tersebut
                let validExistingReminder: Date? = {
                    guard resolvedStatus != .selesai, let rem = existingItem?.reminderAt else { return nil }
                    return NotificationService.isValidCustomReminder(reminderAt: rem, deadline: deadline) ? rem : nil
                }()
                let updatedTask = TugasItem(
                    id: existingId,
                    idJadwal: idJadwal,
                    namaTugas: namaTugas,
                    deadline: deadline,
                    prioritas: prioritas,
                    jenis: jenis,
                    status: resolvedStatus,
                    progress: currentProgress,
                    isPinned: existingPinned,
                    reminderAt: validExistingReminder
                )
                _ = try await dataService.updateTugas(updatedTask)
                if validExistingReminder == nil && existingItem?.reminderAt != nil {
                    NotificationService.shared.cancelCustomReminderForTask(id: existingId)
                }
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
                    progress: 0,
                    isPinned: false,
                    reminderAt: nil
                )
                _ = try await dataService.createTugas(newTask)
                editingTask = nil
                await loadDashboardData()
                let createdId = urgentTasks.first(where: { $0.namaTugas == namaTugas && $0.idJadwal == idJadwal })?.id
                let courseName = courses.first(where: { $0.id == idJadwal })?.namaMatkul ?? "Tugas Akademik"
                let df = DateFormatter()
                df.locale = Locale(identifier: "id_ID")
                df.dateStyle = .medium
                ActivityInboxStore.shared.enqueueArrival(
                    NotificationItem(
                        id: NotificationItem.canonicalId(kind: "created", entityType: "task", entityId: createdId, fallbackTitle: namaTugas),
                        judul: namaTugas,
                        namaMatkul: courseName,
                        waktu: "Tenggat \(df.string(from: deadline))",
                        tipe: .tugas,
                        isUrgent: prioritas == .tinggi,
                        entityType: "task",
                        entityId: createdId,
                        eventKind: "created"
                    ),
                    triggerFlight: true
                )
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
                let createdId = replacementClasses.first(where: { $0.idJadwal == idJadwal && $0.waktuMulai == waktuMulai })?.id
                let courseName = courses.first(where: { $0.id == idJadwal })?.namaMatkul ?? "Kelas Pengganti"
                let df = DateFormatter()
                df.locale = Locale(identifier: "id_ID")
                df.dateStyle = .medium
                ActivityInboxStore.shared.enqueueArrival(
                    NotificationItem(
                        id: NotificationItem.canonicalId(kind: "created", entityType: "replacementClass", entityId: createdId, fallbackTitle: courseName),
                        judul: "Kelas Pengganti \(courseName)",
                        namaMatkul: lokasi.flatMap { $0.isEmpty ? nil : "Ruang \($0)" } ?? courseName,
                        waktu: "\(df.string(from: tanggal)) • \(waktuMulai)",
                        tipe: .pengganti,
                        isUrgent: false,
                        entityType: "replacementClass",
                        entityId: createdId,
                        eventKind: "created"
                    ),
                    triggerFlight: true
                )
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
        ActivityInboxStore.shared.syncWithAcademicState(
            tasks: urgentTasks + completedTasks,
            exams: allExams,
            replacementClasses: replacementClasses
        )
        notifications = ActivityInboxStore.shared.items
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

