import Foundation
import AppIntents

// MARK: - Helper Formatting
private func getIndonesianDayName(from date: Date = Date()) -> String {
    let weekday = Calendar.current.component(.weekday, from: date)
    switch weekday {
    case 1: return "Minggu"
    case 2: return "Senin"
    case 3: return "Selasa"
    case 4: return "Rabu"
    case 5: return "Kamis"
    case 6: return "Jumat"
    case 7: return "Sabtu"
    default: return ""
    }
}

// MARK: - 1. Intent: Jadwal Hari Ini
public struct GetTodayScheduleIntent: AppIntent {
    public static var title: LocalizedStringResource = "Lihat Jadwal Kuliah Hari Ini"
    public static var description = IntentDescription("Menampilkan jadwal kuliah reguler dan kelas pengganti untuk hari ini dari TrackerThings.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let todayDayName = getIndonesianDayName()
        let isOffline = NetworkMonitor.shared.isDisconnected

        // Ambil jadwal reguler dari cache
        let allCourses: [JadwalItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal) ?? []
        let todayCourses = allCourses.filter { course in
            course.hari.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == todayDayName.lowercased()
        }.sorted { ($0.waktuMulai) < ($1.waktuMulai) }

        // Ambil kelas pengganti dari cache
        let calendar = Calendar.current
        let startOfToday = calendar.startOfDay(for: Date())
        let endOfToday = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? Date()

        let allClasses: [KelasPenggantiItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyKelasPengganti) ?? []
        let todayReplacement = allClasses.filter { item in
            item.tanggal >= startOfToday && item.tanggal < endOfToday && item.status.lowercased() != "selesai"
        }

        var lines: [String] = []

        if todayCourses.isEmpty && todayReplacement.isEmpty {
            var msg = "Tidak ada jadwal kuliah hari ini (\(todayDayName)). Santai dan istirahatlah!"
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        lines.append("Jadwal hari ini (\(todayDayName)):")

        for course in todayCourses {
            let lokasiStr = course.lokasi.map { " di \($0)" } ?? ""
            lines.append("• \(course.waktuMulai)-\(course.waktuSelesai): \(course.namaMatkul)\(lokasiStr)")
        }

        for rep in todayReplacement {
            let nama = rep.jadwal?.namaMatkul ?? "Kelas Pengganti"
            let lokasiStr = rep.lokasi.map { " di \($0)" } ?? ""
            lines.append("• \(rep.waktuMulai)-\(rep.waktuSelesai) [Pengganti]: \(nama)\(lokasiStr)")
        }

        if isOffline {
            lines.append("(Berdasarkan data cache lokal offline)")
        }

        return .result(dialog: IntentDialog(stringLiteral: lines.joined(separator: "\n")))
    }
}

// MARK: - 2. Intent: Tugas Terdekat
public struct GetUrgentTasksIntent: AppIntent {
    public static var title: LocalizedStringResource = "Lihat Tugas Terdekat"
    public static var description = IntentDescription("Menampilkan tugas kuliah yang belum selesai dengan deadline terdekat dari TrackerThings.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let isOffline = NetworkMonitor.shared.isDisconnected
        let tasks: [TugasItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyTugas) ?? []

        let pendingTasks = tasks.filter { $0.status != .selesai }
            .sorted { $0.deadline < $1.deadline }

        if pendingTasks.isEmpty {
            var msg = "Bagus sekali! Tidak ada tugas yang tertunda di TrackerThings."
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        let topTasks = pendingTasks.prefix(5)
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        df.locale = Locale(identifier: "id_ID")

        var lines: [String] = ["Tugas yang perlu diselesaikan:"]
        for task in topTasks {
            let courseName = task.jadwal?.namaMatkul.map { " (\($0))" } ?? ""
            let deadlineStr = df.string(from: task.deadline)
            lines.append("• \(task.namaTugas)\(courseName) - Deadline: \(deadlineStr)")
        }

        if pendingTasks.count > 5 {
            lines.append("...dan \(pendingTasks.count - 5) tugas lainnya.")
        }

        if isOffline {
            lines.append("(Berdasarkan data cache lokal offline)")
        }

        return .result(dialog: IntentDialog(stringLiteral: lines.joined(separator: "\n")))
    }
}

// MARK: - 3. Intent: Ujian Berikutnya
public struct GetNextExamIntent: AppIntent {
    public static var title: LocalizedStringResource = "Lihat Ujian Berikutnya"
    public static var description = IntentDescription("Menampilkan jadwal ujian mendatang dari TrackerThings.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let isOffline = NetworkMonitor.shared.isDisconnected
        let exams: [UjianItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyUjian) ?? []

        let now = Date()
        let upcomingExams = exams.filter { $0.tanggal >= now.addingTimeInterval(-86400) }
            .sorted { $0.tanggal < $1.tanggal }

        if upcomingExams.isEmpty {
            var msg = "Tidak ada jadwal ujian mendatang di TrackerThings."
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        let df = DateFormatter()
        df.dateStyle = .full
        df.locale = Locale(identifier: "id_ID")

        let next = upcomingExams[0]
        let matkul = next.jadwal?.namaMatkul ?? "Mata Kuliah"
        let tanggalStr = df.string(from: next.tanggal)
        let waktuStr = [next.waktuMulai, next.waktuSelesai].compactMap { $0 }.joined(separator: " - ")
        let ruangStr = next.ruangan.map { " di Ruang \($0)" } ?? ""

        var msg = "Ujian terdekat: \(next.jenisUjian) \(matkul) pada \(tanggalStr)"
        if !waktuStr.isEmpty {
            msg += ", pukul \(waktuStr)"
        }
        msg += "\(ruangStr)."

        if upcomingExams.count > 1 {
            msg += " Total \(upcomingExams.count) ujian mendatang terdaftar."
        }

        if isOffline {
            msg += " (Data cache offline)"
        }

        return .result(dialog: IntentDialog(stringLiteral: msg))
    }
}

// MARK: - 4. Intent: Buka Tab Tertentu (Deep Link AppIntent)
public enum TrackerThingsTabParam: String, AppEnum {
    case home = "home"
    case courses = "courses"
    case exams = "exams"
    case settings = "settings"

    public static var typeDisplayRepresentation: TypeDisplayRepresentation = "Menu TrackerThings"
    public static var caseDisplayRepresentations: [TrackerThingsTabParam: DisplayRepresentation] = [
        .home: DisplayRepresentation(title: "Home / Beranda"),
        .courses: DisplayRepresentation(title: "Mata Kuliah"),
        .exams: DisplayRepresentation(title: "Ujian"),
        .settings: DisplayRepresentation(title: "Pengaturan")
    ]
}

public struct OpenTrackerThingsTabIntent: AppIntent, OpenIntent {
    public static var title: LocalizedStringResource = "Buka Menu TrackerThings"
    public static var description = IntentDescription("Membuka menu tertentu di TrackerThings.")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Menu")
    public var target: TrackerThingsTabParam

    public init() {
        self.target = .home
    }

    public init(target: TrackerThingsTabParam) {
        self.target = target
    }

    public func perform() async throws -> some IntentResult {
        // App will open foregrounded, URL notification handled via custom URL scheme or NotificationCenter
        await MainActor.run {
            NotificationCenter.default.post(
                name: .openTrackerThingsDestination,
                object: nil,
                userInfo: ["destination": target.rawValue]
            )
        }
        return .result()
    }
}

// MARK: - 5. AppShortcutsProvider (Siri Phrases)
public struct TrackerThingsShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetTodayScheduleIntent(),
            phrases: [
                "Jadwal hari ini di \(.applicationName)",
                "Cek jadwal kuliah di \(.applicationName)",
                "Ada kuliah apa hari ini di \(.applicationName)"
            ],
            shortTitle: "Jadwal Hari Ini",
            systemImageName: "calendar"
        )
        AppShortcut(
            intent: GetUrgentTasksIntent(),
            phrases: [
                "Tugas terdekat di \(.applicationName)",
                "Cek tugas di \(.applicationName)",
                "Apa tugas kuliah berikutnya di \(.applicationName)"
            ],
            shortTitle: "Tugas Terdekat",
            systemImageName: "checklist"
        )
        AppShortcut(
            intent: GetNextExamIntent(),
            phrases: [
                "Ujian berikutnya di \(.applicationName)",
                "Kapan ujian di \(.applicationName)",
                "Cek jadwal ujian di \(.applicationName)"
            ],
            shortTitle: "Ujian Berikutnya",
            systemImageName: "graduationcap"
        )
    }
}

