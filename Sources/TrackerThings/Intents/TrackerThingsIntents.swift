import Foundation
import AppIntents

// MARK: - Academic Widget & Timeline Read Models (Widget Readiness)

public struct WidgetCourseItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let namaMatkul: String
    public let waktuMulai: String
    public let waktuSelesai: String
    public let ruangan: String?
    public let isReplacement: Bool

    public init(
        id: Int,
        namaMatkul: String,
        waktuMulai: String,
        waktuSelesai: String,
        ruangan: String? = nil,
        isReplacement: Bool = false
    ) {
        self.id = id
        self.namaMatkul = namaMatkul
        self.waktuMulai = waktuMulai
        self.waktuSelesai = waktuSelesai
        self.ruangan = ruangan
        self.isReplacement = isReplacement
    }
}

public struct WidgetTaskItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let namaTugas: String
    public let namaMatkul: String?
    public let deadlineDateString: String
    public let prioritas: String
    public let urgencyCategory: String // "overdue" | "due_today" | "due_tomorrow" | "upcoming"
    public let daysRemaining: Int

    public init(
        id: Int,
        namaTugas: String,
        namaMatkul: String? = nil,
        deadlineDateString: String,
        prioritas: String,
        urgencyCategory: String,
        daysRemaining: Int
    ) {
        self.id = id
        self.namaTugas = namaTugas
        self.namaMatkul = namaMatkul
        self.deadlineDateString = deadlineDateString
        self.prioritas = prioritas
        self.urgencyCategory = urgencyCategory
        self.daysRemaining = daysRemaining
    }
}

public struct WidgetExamItem: Codable, Sendable, Identifiable, Hashable {
    public let id: Int
    public let jenisUjian: String
    public let namaMatkul: String
    public let tanggalString: String
    public let waktu: String
    public let ruangan: String?
    public let daysRemaining: Int

    public init(
        id: Int,
        jenisUjian: String,
        namaMatkul: String,
        tanggalString: String,
        waktu: String,
        ruangan: String? = nil,
        daysRemaining: Int
    ) {
        self.id = id
        self.jenisUjian = jenisUjian
        self.namaMatkul = namaMatkul
        self.tanggalString = tanggalString
        self.waktu = waktu
        self.ruangan = ruangan
        self.daysRemaining = daysRemaining
    }
}

public struct AcademicWidgetSnapshot: Codable, Sendable, Hashable {
    public let generatedAt: Date
    public let referenceDateString: String
    public let dayName: String
    public let isAuthenticated: Bool
    public let userName: String?
    public let todayCourses: [WidgetCourseItem]
    public let urgentTasks: [WidgetTaskItem]
    public let nextExam: WidgetExamItem?
    public let summaryText: String
    public let activeAlertCount: Int

    public init(
        generatedAt: Date,
        referenceDateString: String,
        dayName: String,
        isAuthenticated: Bool,
        userName: String?,
        todayCourses: [WidgetCourseItem],
        urgentTasks: [WidgetTaskItem],
        nextExam: WidgetExamItem?,
        summaryText: String,
        activeAlertCount: Int
    ) {
        self.generatedAt = generatedAt
        self.referenceDateString = referenceDateString
        self.dayName = dayName
        self.isAuthenticated = isAuthenticated
        self.userName = userName
        self.todayCourses = todayCourses
        self.urgentTasks = urgentTasks
        self.nextExam = nextExam
        self.summaryText = summaryText
        self.activeAlertCount = activeAlertCount
    }
}

// MARK: - Widget Data Provider & Domain Aggregator

public final class WidgetDataProvider: Sendable {
    public static let shared = WidgetDataProvider()

    private init() {}

    public func getIndonesianDayName(from date: Date = Date(), calendar: Calendar = Calendar.current) -> String {
        let weekday = calendar.component(.weekday, from: date)
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

    public func calculateDaysRemaining(from referenceDate: Date, to targetDate: Date, calendar: Calendar = Calendar.current) -> Int {
        let startRef = calendar.startOfDay(for: referenceDate)
        let startTarget = calendar.startOfDay(for: targetDate)
        let components = calendar.dateComponents([.day], from: startRef, to: startTarget)
        return components.day ?? 0
    }

    public func resolveTaskUrgency(daysRemaining: Int) -> String {
        if daysRemaining < 0 {
            return "overdue"
        } else if daysRemaining == 0 {
            return "due_today"
        } else if daysRemaining == 1 {
            return "due_tomorrow"
        } else {
            return "upcoming"
        }
    }

    public func isUserAuthenticated() -> Bool {
        let token = KeychainHelper.shared.getToken()
        let profile: UserProfile? = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile)
        return (token != nil && !token!.isEmpty) || profile != nil
    }

    public func generateSnapshot(
        referenceDate: Date = Date(),
        calendar: Calendar = Calendar.current,
        courses: [JadwalItem]?,
        replacements: [KelasPenggantiItem]?,
        tasks: [TugasItem]?,
        exams: [UjianItem]?,
        userProfile: UserProfile?,
        isAuthenticated: Bool
    ) -> AcademicWidgetSnapshot {
        let refDateStr = CalendarDateHelper.formatCalendarDate(referenceDate)
        let dayName = getIndonesianDayName(from: referenceDate, calendar: calendar)

        if !isAuthenticated {
            return AcademicWidgetSnapshot(
                generatedAt: Date(),
                referenceDateString: refDateStr,
                dayName: dayName,
                isAuthenticated: false,
                userName: nil,
                todayCourses: [],
                urgentTasks: [],
                nextExam: nil,
                summaryText: "Silakan masuk ke TrackerThings untuk melihat ringkasan akademik Anda.",
                activeAlertCount: 0
            )
        }

        // 1. Jadwal Kuliah Hari Ini (Reguler + Kelas Pengganti)
        var todayCourseList: [WidgetCourseItem] = []
        if let allCourses = courses {
            let filtered = allCourses.filter {
                $0.hari.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == dayName.lowercased()
            }
            for c in filtered {
                todayCourseList.append(WidgetCourseItem(
                    id: c.id,
                    namaMatkul: c.namaMatkul,
                    waktuMulai: c.waktuMulai,
                    waktuSelesai: c.waktuSelesai,
                    ruangan: c.lokasi,
                    isReplacement: false
                ))
            }
        }

        let startOfToday = calendar.startOfDay(for: referenceDate)
        let endOfToday = calendar.date(byAdding: .day, value: 1, to: startOfToday) ?? referenceDate
        if let allReplacements = replacements {
            let activeKP = allReplacements.filter {
                $0.tanggal >= startOfToday && $0.tanggal < endOfToday && $0.status.lowercased() != "selesai"
            }
            for kp in activeKP {
                let nama = kp.jadwal?.namaMatkul ?? "Kelas Pengganti"
                todayCourseList.append(WidgetCourseItem(
                    id: kp.id,
                    namaMatkul: nama,
                    waktuMulai: kp.waktuMulai,
                    waktuSelesai: kp.waktuSelesai,
                    ruangan: kp.lokasi,
                    isReplacement: true
                ))
            }
        }
        todayCourseList.sort {
            if $0.waktuMulai != $1.waktuMulai {
                return $0.waktuMulai < $1.waktuMulai
            }
            return $0.id < $1.id
        }

        // 2. Tugas Mendesak (Prioritas & Batas Waktu Terdekat)
        let priorityOrder: [TugasItem.PrioritasTugas: Int] = [
            .tinggi: 1,
            .sedang: 2,
            .rendah: 3
        ]

        var pendingTaskList: [WidgetTaskItem] = []
        if let allTasks = tasks {
            let uncompleted = allTasks.filter { $0.status != .selesai }
                .sorted { a, b in
                    if a.deadline != b.deadline {
                        return a.deadline < b.deadline
                    }
                    let prioA = priorityOrder[a.prioritas] ?? 2
                    let prioB = priorityOrder[b.prioritas] ?? 2
                    if prioA != prioB {
                        return prioA < prioB
                    }
                    return a.id < b.id
                }

            for t in uncompleted {
                let days = calculateDaysRemaining(from: referenceDate, to: t.deadline, calendar: calendar)
                let category = resolveTaskUrgency(daysRemaining: days)
                let deadStr = CalendarDateHelper.formatCalendarDate(t.deadline)
                pendingTaskList.append(WidgetTaskItem(
                    id: t.id,
                    namaTugas: t.namaTugas,
                    namaMatkul: t.jadwal?.namaMatkul,
                    deadlineDateString: deadStr,
                    prioritas: t.prioritas.rawValue,
                    urgencyCategory: category,
                    daysRemaining: days
                ))
            }
        }

        // 3. Ujian Mendatang Terdekat
        var nextExamItem: WidgetExamItem? = nil
        if let allExams = exams {
            let upcoming = allExams.filter {
                calendar.startOfDay(for: $0.tanggal) >= startOfToday
            }.sorted { a, b in
                if a.tanggal != b.tanggal {
                    return a.tanggal < b.tanggal
                }
                let timeA = a.waktuMulai ?? ""
                let timeB = b.waktuMulai ?? ""
                if timeA != timeB {
                    return timeA < timeB
                }
                return a.id < b.id
            }

            if let firstExam = upcoming.first {
                let days = calculateDaysRemaining(from: referenceDate, to: firstExam.tanggal, calendar: calendar)
                let tglStr = CalendarDateHelper.formatCalendarDate(firstExam.tanggal)
                let waktuStr = [firstExam.waktuMulai, firstExam.waktuSelesai].compactMap { $0 }.joined(separator: " - ")
                nextExamItem = WidgetExamItem(
                    id: firstExam.id,
                    jenisUjian: firstExam.jenisUjian,
                    namaMatkul: firstExam.jadwal?.namaMatkul ?? "Mata Kuliah",
                    tanggalString: tglStr,
                    waktu: waktuStr,
                    ruangan: firstExam.ruangan,
                    daysRemaining: days
                )
            }
        }

        // 4. Ringkasan & Hitungan Notifikasi Aktif
        let urgentAlertCount = pendingTaskList.filter { $0.urgencyCategory == "overdue" || $0.urgencyCategory == "due_today" }.count
        let totalAlertCount = todayCourseList.count + urgentAlertCount

        var summaryPieces: [String] = []
        if !todayCourseList.isEmpty {
            summaryPieces.append("\(todayCourseList.count) kelas hari ini")
        }
        if urgentAlertCount > 0 {
            summaryPieces.append("\(urgentAlertCount) tugas mendesak")
        }
        if let nextExam = nextExamItem, nextExam.daysRemaining <= 2 {
            summaryPieces.append("ujian dalam \(nextExam.daysRemaining) hari")
        }

        let summary = summaryPieces.isEmpty ? "Semua jadwal terkendali hari ini." : summaryPieces.joined(separator: ", ")

        return AcademicWidgetSnapshot(
            generatedAt: Date(),
            referenceDateString: refDateStr,
            dayName: dayName,
            isAuthenticated: true,
            userName: userProfile?.fullName ?? userProfile?.username,
            todayCourses: todayCourseList,
            urgentTasks: pendingTaskList,
            nextExam: nextExamItem,
            summaryText: summary,
            activeAlertCount: totalAlertCount
        )
    }

    public func currentSnapshot(referenceDate: Date = Date(), calendar: Calendar = Calendar.current) -> AcademicWidgetSnapshot {
        let auth = isUserAuthenticated()
        let profile: UserProfile? = LocalCacheService.shared.load(forKey: LocalCacheService.keyUserProfile)
        let courses: [JadwalItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal)
        let replacements: [KelasPenggantiItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyKelasPengganti)
        let tasks: [TugasItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyTugas)
        let exams: [UjianItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyUjian)

        return generateSnapshot(
            referenceDate: referenceDate,
            calendar: calendar,
            courses: courses,
            replacements: replacements,
            tasks: tasks,
            exams: exams,
            userProfile: profile,
            isAuthenticated: auth
        )
    }

    public func fetchTodaySchedule(referenceDate: Date = Date(), calendar: Calendar = Calendar.current) -> [WidgetCourseItem] {
        return currentSnapshot(referenceDate: referenceDate, calendar: calendar).todayCourses
    }

    public func fetchUrgentTasks(referenceDate: Date = Date(), limit: Int = 5, calendar: Calendar = Calendar.current) -> [WidgetTaskItem] {
        let allTasks = currentSnapshot(referenceDate: referenceDate, calendar: calendar).urgentTasks
        return Array(allTasks.prefix(limit))
    }

    public func fetchNextExam(referenceDate: Date = Date(), calendar: Calendar = Calendar.current) -> WidgetExamItem? {
        return currentSnapshot(referenceDate: referenceDate, calendar: calendar).nextExam
    }
}

// MARK: - 1. Intent: Jadwal Hari Ini
public struct GetTodayScheduleIntent: AppIntent {
    public static let title: LocalizedStringResource = "Lihat Jadwal Kuliah Hari Ini"
    public static let description = IntentDescription("Menampilkan jadwal kuliah reguler dan kelas pengganti untuk hari ini dari TrackerThings.")
    public static let openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let provider = WidgetDataProvider.shared
        guard provider.isUserAuthenticated() else {
            return .result(dialog: IntentDialog(stringLiteral: "Anda belum masuk ke akun TrackerThings. Silakan buka aplikasi TrackerThings dan masuk terlebih dahulu untuk melihat jadwal kuliah."))
        }

        let isOffline = await MainActor.run { !NetworkMonitor.shared.isConnected }
        let cachedCourses: [JadwalItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal)
        let cachedKP: [KelasPenggantiItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyKelasPengganti)

        if cachedCourses == nil && cachedKP == nil {
            return .result(dialog: IntentDialog(stringLiteral: "Data jadwal TrackerThings belum tersimpan di perangkat. Buka aplikasi TrackerThings terlebih dahulu untuk menyinkronkan jadwal kuliah Anda."))
        }

        let todayCourses = provider.fetchTodaySchedule()
        let todayDayName = provider.getIndonesianDayName()

        if todayCourses.isEmpty {
            var msg = "Tidak ada jadwal kuliah hari ini (\(todayDayName)). Santai dan istirahatlah!"
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        var lines: [String] = ["Jadwal hari ini (\(todayDayName)):"]
        for course in todayCourses {
            let lokasiStr = course.ruangan.map { " di \($0)" } ?? ""
            let tag = course.isReplacement ? " [Pengganti]" : ""
            lines.append("• \(course.waktuMulai)-\(course.waktuSelesai)\(tag): \(course.namaMatkul)\(lokasiStr)")
        }

        if isOffline {
            lines.append("(Berdasarkan data cache lokal offline)")
        }

        return .result(dialog: IntentDialog(stringLiteral: lines.joined(separator: "\n")))
    }
}

// MARK: - 2. Intent: Tugas Terdekat
public struct GetUrgentTasksIntent: AppIntent {
    public static let title: LocalizedStringResource = "Lihat Tugas Terdekat"
    public static let description = IntentDescription("Menampilkan tugas kuliah yang belum selesai dengan deadline terdekat dari TrackerThings.")
    public static let openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let provider = WidgetDataProvider.shared
        guard provider.isUserAuthenticated() else {
            return .result(dialog: IntentDialog(stringLiteral: "Anda belum masuk ke akun TrackerThings. Silakan buka aplikasi TrackerThings dan masuk terlebih dahulu untuk melihat daftar tugas."))
        }

        let isOffline = await MainActor.run { !NetworkMonitor.shared.isConnected }
        let cachedTasks: [TugasItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyTugas)

        guard let _ = cachedTasks else {
            return .result(dialog: IntentDialog(stringLiteral: "Data tugas TrackerThings belum tersimpan di perangkat. Buka aplikasi TrackerThings terlebih dahulu untuk menyinkronkan tugas Anda."))
        }

        let topTasks = provider.fetchUrgentTasks(limit: 5)
        let allPendingCount = provider.currentSnapshot().urgentTasks.count

        if topTasks.isEmpty {
            var msg = "Bagus sekali! Tidak ada tugas yang tertunda di TrackerThings."
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        var lines: [String] = ["Tugas yang perlu diselesaikan:"]
        for task in topTasks {
            let courseName = task.namaMatkul.map { " (\($0))" } ?? ""
            let urgencyTag: String
            switch task.urgencyCategory {
            case "overdue": urgencyTag = " [Terlewat]"
            case "due_today": urgencyTag = " [Hari Ini]"
            case "due_tomorrow": urgencyTag = " [Besok]"
            default: urgencyTag = ""
            }
            lines.append("• \(task.namaTugas)\(courseName)\(urgencyTag) - Deadline: \(task.deadlineDateString)")
        }

        if allPendingCount > 5 {
            lines.append("...dan \(allPendingCount - 5) tugas lainnya.")
        }

        if isOffline {
            lines.append("(Berdasarkan data cache lokal offline)")
        }

        return .result(dialog: IntentDialog(stringLiteral: lines.joined(separator: "\n")))
    }
}

// MARK: - 3. Intent: Ujian Berikutnya
public struct GetNextExamIntent: AppIntent {
    public static let title: LocalizedStringResource = "Lihat Ujian Berikutnya"
    public static let description = IntentDescription("Menampilkan jadwal ujian mendatang dari TrackerThings.")
    public static let openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let provider = WidgetDataProvider.shared
        guard provider.isUserAuthenticated() else {
            return .result(dialog: IntentDialog(stringLiteral: "Anda belum masuk ke akun TrackerThings. Silakan buka aplikasi TrackerThings dan masuk terlebih dahulu untuk melihat jadwal ujian."))
        }

        let isOffline = await MainActor.run { !NetworkMonitor.shared.isConnected }
        let cachedExams: [UjianItem]? = LocalCacheService.shared.load(forKey: LocalCacheService.keyUjian)

        guard let _ = cachedExams else {
            return .result(dialog: IntentDialog(stringLiteral: "Data jadwal ujian TrackerThings belum tersimpan di perangkat. Buka aplikasi TrackerThings terlebih dahulu untuk menyinkronkan jadwal ujian Anda."))
        }

        let snapshot = provider.currentSnapshot()
        guard let next = snapshot.nextExam else {
            var msg = "Tidak ada jadwal ujian mendatang di TrackerThings."
            if isOffline {
                msg += " (Data cache offline)"
            }
            return .result(dialog: IntentDialog(stringLiteral: msg))
        }

        let ruangStr = next.ruangan.map { " di Ruang \($0)" } ?? ""
        let waktuStr = next.waktu.isEmpty ? "" : ", pukul \(next.waktu)"
        let countdownStr: String
        if next.daysRemaining == 0 {
            countdownStr = " (Hari Ini!)"
        } else if next.daysRemaining == 1 {
            countdownStr = " (Besok!)"
        } else {
            countdownStr = " (\(next.daysRemaining) hari lagi)"
        }

        var msg = "Ujian terdekat: \(next.jenisUjian) \(next.namaMatkul) pada \(next.tanggalString)\(waktuStr)\(ruangStr)\(countdownStr)."

        if isOffline {
            msg += " (Data cache offline)"
        }

        return .result(dialog: IntentDialog(stringLiteral: msg))
    }
}

// MARK: - 4. Intent: Buka Tab Tertentu (Deep Link AppIntent)
public enum TrackerThingsTabParam: String, AppEnum {
    case home = "home"
    case tasks = "tasks"
    case courses = "courses"
    case exams = "exams"
    case settings = "settings"

    public static let typeDisplayRepresentation: TypeDisplayRepresentation = "Menu TrackerThings"
    public static let caseDisplayRepresentations: [TrackerThingsTabParam: DisplayRepresentation] = [
        .home: DisplayRepresentation(title: "Home / Beranda"),
        .tasks: DisplayRepresentation(title: "Tugas Kuliah"),
        .courses: DisplayRepresentation(title: "Mata Kuliah"),
        .exams: DisplayRepresentation(title: "Ujian"),
        .settings: DisplayRepresentation(title: "Pengaturan")
    ]
}

public struct OpenTrackerThingsTabIntent: AppIntent, OpenIntent {
    public static let title: LocalizedStringResource = "Buka Menu TrackerThings"
    public static let description = IntentDescription("Membuka menu tertentu di TrackerThings.")
    public static let openAppWhenRun: Bool = true

    @Parameter(title: "Menu")
    public var target: TrackerThingsTabParam

    public init() {
        self.target = .home
    }

    public init(target: TrackerThingsTabParam) {
        self.target = target
    }

    public func perform() async throws -> some IntentResult {
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
        AppShortcut(
            intent: OpenTrackerThingsTabIntent(target: .tasks),
            phrases: [
                "Buka tugas di \(.applicationName)",
                "Lihat tugas di \(.applicationName)"
            ],
            shortTitle: "Buka Tugas",
            systemImageName: "list.bullet.rectangle"
        )
    }
}
