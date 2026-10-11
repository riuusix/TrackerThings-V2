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

            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    public func updateTaskProgress(task: TugasItem, progress: Int) async {
        do {
            _ = try await dataService.updateTugasProgress(id: task.id, progress: progress)
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func saveTask(
        namaTugas: String,
        idJadwal: Int,
        deadline: Date,
        prioritas: TugasItem.PrioritasTugas,
        jenis: TugasItem.JenisTugas
    ) async -> Bool {
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
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    public func markReplacementCompleted(item: JadwalGabunganItem) async {
        guard item.tipe == .pengganti else { return }
        do {
            _ = try await dataService.selesaiKelasPengganti(id: item.id)
            await loadDashboardData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func generateNotifications() {
        var notifs: [NotificationItem] = []
        let now = Date()
        let twoDaysLater = Calendar.current.date(byAdding: .day, value: 2, to: now) ?? now

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "id_ID")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short

        for task in urgentTasks where task.deadline >= now && task.deadline <= twoDaysLater {
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

