import Foundation
import SwiftUI

@Observable
@MainActor
public final class DashboardViewModel {
    public var courses: [JadwalItem] = []
    public var urgentTasks: [TugasItem] = []
    public var completedTasks: [TugasItem] = []
    public var upcomingExam: UjianItem?
    public var replacementClasses: [KelasPenggantiItem] = []
    public var notifications: [NotificationItem] = []
    public var selectedDay: String = "Senin"
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var toast: FeedbackToastData?

    // MARK: - In-Flight Request Guards & Race Condition Mitigation
    public private(set) var isSavingTask: Bool = false
    public private(set) var isSavingReplacement: Bool = false
    public private(set) var inFlightTaskIds: Set<Int> = []
    public private(set) var inFlightReplacementIds: Set<Int> = []
    private var currentLoadId: UUID = UUID()

    public func showToast(_ message: String, severity: FeedbackSeverity = .info) {
        self.toast = FeedbackToastData(message: message, severity: severity)
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
            replacementClasses = loadedKP

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

            isLoading = false
        } catch {
            guard loadId == self.currentLoadId else { return }
            errorMessage = error.localizedDescription
            isLoading = false
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
        namaTugas: String,
        idJadwal: Int,
        deadline: Date,
        prioritas: TugasItem.PrioritasTugas,
        jenis: TugasItem.JenisTugas
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menambah tugas saat offline. Hubungkan ke internet untuk menyimpan ke server.", severity: .warning)
            return false
        }

        guard !isSavingTask else { return false }
        isSavingTask = true
        defer { isSavingTask = false }

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

        do {
            _ = try await dataService.createTugas(newTask)
            await loadDashboardData()
            showToast("Tugas baru berhasil ditambahkan!", severity: .success)
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    public func deleteTask(id: Int) async {
        guard !isOffline else {
            showToast("Tidak dapat menghapus tugas saat offline.", severity: .warning)
            return
        }

        guard !inFlightTaskIds.contains(id) else { return }
        inFlightTaskIds.insert(id)
        defer { inFlightTaskIds.remove(id) }

        do {
            _ = try await dataService.deleteTugas(id: id)
            NotificationService.shared.cancelReminderForTask(id: id)
            showToast("Tugas berhasil dihapus.", severity: .success)
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
        }
    }

    public func saveKelasPengganti(
        idJadwal: Int,
        tanggal: Date,
        waktuMulai: String,
        waktuSelesai: String,
        lokasi: String?,
        catatan: String?
    ) async -> Bool {
        guard !isOffline else {
            showToast("Tidak dapat menambah kelas pengganti saat offline.", severity: .warning)
            return false
        }

        guard !isSavingReplacement else { return false }
        isSavingReplacement = true
        defer { isSavingReplacement = false }

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

        do {
            _ = try await dataService.createKelasPengganti(newKP)
            await loadDashboardData()
            showToast("Kelas pengganti berhasil ditambahkan!", severity: .success)
            return true
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
            return false
        }
    }

    public func markReplacementCompleted(item: JadwalGabunganItem) async {
        guard item.tipe == .pengganti else { return }
        guard !isOffline else {
            showToast("Tidak dapat mengubah status saat offline.", severity: .warning)
            return
        }

        guard !inFlightReplacementIds.contains(item.id) else { return }
        inFlightReplacementIds.insert(item.id)
        defer { inFlightReplacementIds.remove(item.id) }

        do {
            _ = try await dataService.selesaiKelasPengganti(id: item.id)
            showToast("Kelas pengganti berhasil diselesaikan!", severity: .success)
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
            showToast(error.localizedDescription, severity: .error)
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

