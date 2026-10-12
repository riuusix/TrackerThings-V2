import Foundation
import UserNotifications

/// Model preferensi kategori pengingat TrackerThings
public struct NotificationPreferences: Codable, Sendable, Equatable {
    public var isClassReminderEnabled: Bool
    public var isTaskReminderEnabled: Bool
    public var isExamReminderEnabled: Bool
    /// Waktu menit sebelum jadwal kuliah dimulai (default: 15 menit)
    public var classLeadTimeMinutes: Int
    /// Waktu jam sebelum ujian dimulai (default: 24 jam / H-1)
    public var examLeadTimeHours: Int

    public init(
        isClassReminderEnabled: Bool = true,
        isTaskReminderEnabled: Bool = true,
        isExamReminderEnabled: Bool = true,
        classLeadTimeMinutes: Int = 15,
        examLeadTimeHours: Int = 24
    ) {
        self.isClassReminderEnabled = isClassReminderEnabled
        self.isTaskReminderEnabled = isTaskReminderEnabled
        self.isExamReminderEnabled = isExamReminderEnabled
        self.classLeadTimeMinutes = classLeadTimeMinutes
        self.examLeadTimeHours = examLeadTimeHours
    }

    private static let userDefaultsKey = "trackerthings_notification_preferences"

    public static func load() -> NotificationPreferences {
        if let data = UserDefaults.standard.data(forKey: userDefaultsKey),
           let prefs = try? JSONDecoder().decode(NotificationPreferences.self, from: data) {
            return prefs
        }
        return NotificationPreferences()
    }

    public func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.userDefaultsKey)
        }
    }
}

/// Delegate internal untuk menangani presentasi notifikasi saat aplikasi berada di latar depan (foreground)
private final class LocalNotificationPresentationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = LocalNotificationPresentationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .badge, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        // Mendukung deep navigation saat banner notifikasi diketuk
        let userInfo = response.notification.request.content.userInfo
        if let destination = userInfo["destination"] as? String {
            await MainActor.run {
                NotificationCenter.default.post(
                    name: .openTrackerThingsDestination,
                    object: nil,
                    userInfo: ["destination": destination]
                )
            }
        }
    }
}

public extension Notification.Name {
    static let openTrackerThingsDestination = Notification.Name("TrackerThings.openDestination")
}

/// Layanan manajemen notifikasi lokal UserNotifications TrackerThings.
/// Menyediakan identifier deterministik, kategori granular, deduplikasi otomatis,
/// dan pembatalan pintar saat jadwal berubah atau dihapus.
public final class NotificationService: Sendable {
    public static let shared = NotificationService()

    private init() {
        UNUserNotificationCenter.current().delegate = LocalNotificationPresentationDelegate.shared
    }

    public func configureForegroundPresentation() {
        UNUserNotificationCenter.current().delegate = LocalNotificationPresentationDelegate.shared
    }

    // MARK: - Izin Notifikasi

    @discardableResult
    public func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            center.delegate = LocalNotificationPresentationDelegate.shared
            return granted
        } catch {
            return false
        }
    }

    public func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    // MARK: - Preferensi Pengguna

    public func getPreferences() -> NotificationPreferences {
        NotificationPreferences.load()
    }

    public func updatePreferences(_ prefs: NotificationPreferences) {
        prefs.save()
    }

    // MARK: - Penjadwalan Tugas (Tasks)

    public func scheduleReminderForTask(
        id: Int,
        title: String,
        courseName: String?,
        deadline: Date
    ) async {
        let prefs = getPreferences()
        guard prefs.isTaskReminderEnabled else {
            cancelReminderForTask(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else { return }

        let now = Date()
        guard deadline > now else {
            cancelReminderForTask(id: id)
            return
        }

        // Jadwal H-1 jika sisa waktu > 24 jam; jadwal H-2 jam jika sisa waktu > 2 jam; atau 1 menit jika sangat mepet
        var reminderDate = deadline.addingTimeInterval(-86400)
        if reminderDate <= now {
            reminderDate = deadline.addingTimeInterval(-7200)
        }
        if reminderDate <= now {
            reminderDate = now.addingTimeInterval(60)
        }

        guard reminderDate > now else { return }

        let coursePrefix = courseName.map { "[\($0)] " } ?? ""
        let body = "\(coursePrefix)Tugas \"\(title)\" mendekati tenggat waktu pengumpulan."

        let content = UNMutableNotificationContent()
        content.title = "Pengingat Tugas TrackerThings"
        content.body = body
        content.sound = .default
        content.badge = 1
        content.userInfo = ["destination": "tasks", "taskId": id]

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: reminderDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "task-\(id)",
            content: content,
            trigger: trigger
        )

        try? await UNUserNotificationCenter.current().add(request)
    }

    public func cancelReminderForTask(id: Int) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["task-\(id)"])
    }

    // MARK: - Penjadwalan Kuliah (Courses)

    public func scheduleReminderForCourse(
        id: Int,
        courseName: String,
        dayOfWeek: String,
        startTime: String,
        location: String?
    ) async {
        let prefs = getPreferences()
        guard prefs.isClassReminderEnabled else {
            cancelReminderForCourse(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else { return }

        // Parsing waktu "HH:mm"
        let parts = startTime.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return }

        // Konversi nama hari Indonesia ke weekday Calendar (1: Minggu, 2: Senin, dst)
        let weekday = weekdayNumber(from: dayOfWeek)
        guard weekday >= 1 && weekday <= 7 else { return }

        // Hitung waktu pengingat dengan pengurangan lead time (misal 15 menit sebelum kuliah)
        var totalMinutes = (hour * 60 + minute) - prefs.classLeadTimeMinutes
        var targetWeekday = weekday
        if totalMinutes < 0 {
            totalMinutes += 24 * 60
            targetWeekday = targetWeekday == 1 ? 7 : targetWeekday - 1
        }
        let reminderHour = totalMinutes / 60
        let reminderMinute = totalMinutes % 60

        let content = UNMutableNotificationContent()
        content.title = "Jadwal Kuliah: \(courseName)"
        var body = "Kuliah dimulai pukul \(startTime)"
        if let loc = location, !loc.isEmpty {
            body += " di \(loc)"
        }
        body += ". Siapkan materi perkuliahan Anda!"
        content.body = body
        content.sound = .default
        content.userInfo = ["destination": "courses", "courseId": id]

        var dateComponents = DateComponents()
        dateComponents.weekday = targetWeekday
        dateComponents.hour = reminderHour
        dateComponents.minute = reminderMinute
        dateComponents.second = 0

        // Trigger berulang setiap minggu pada hari dan jam perkuliahan
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

        let request = UNNotificationRequest(
            identifier: "course-\(id)",
            content: content,
            trigger: trigger
        )

        try? await UNUserNotificationCenter.current().add(request)
    }

    public func cancelReminderForCourse(id: Int) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["course-\(id)"])
    }

    // MARK: - Penjadwalan Ujian (Exams)

    public func scheduleReminderForExam(
        id: Int,
        courseName: String?,
        examType: String,
        examDate: Date,
        startTime: String?,
        room: String?
    ) async {
        let prefs = getPreferences()
        guard prefs.isExamReminderEnabled else {
            cancelReminderForExam(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else { return }

        let now = Date()
        // Buat trigger date H-1 (atau sesuai examLeadTimeHours)
        var triggerDate = examDate.addingTimeInterval(-Double(prefs.examLeadTimeHours * 3600))
        if triggerDate <= now {
            triggerDate = examDate.addingTimeInterval(-7200) // H-2 jam jika H-1 sudah lewat
        }
        if triggerDate <= now {
            triggerDate = now.addingTimeInterval(60) // 1 menit jika hari H
        }

        guard examDate > now, triggerDate > now else {
            cancelReminderForExam(id: id)
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Pengingat Ujian: \(examType)"
        var body = "\(courseName ?? "Ujian Akademik")"
        if let start = startTime, !start.isEmpty {
            body += " pukul \(start)"
        }
        if let r = room, !r.isEmpty {
            body += " di ruangan \(r)"
        }
        body += ". Pastikan persiapan belajar dan perlengkapan Anda siap!"
        content.body = body
        content.sound = .default
        content.badge = 1
        content.userInfo = ["destination": "exams", "examId": id]

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: triggerDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "exam-\(id)",
            content: content,
            trigger: trigger
        )

        try? await UNUserNotificationCenter.current().add(request)
    }

    public func cancelReminderForExam(id: Int) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["exam-\(id)"])
    }

    // MARK: - Sinkronisasi Menyeluruh (Deduplikasi Bersih)

    public func syncAllReminders(
        courses: [JadwalItem],
        tasks: [TugasItem],
        exams: [UjianItem]
    ) async {
        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else { return }

        let prefs = getPreferences()

        // 1. Jadwal Kuliah
        if prefs.isClassReminderEnabled {
            for c in courses {
                await scheduleReminderForCourse(
                    id: c.id,
                    courseName: c.namaMatkul,
                    dayOfWeek: c.hari,
                    startTime: c.waktuMulai,
                    location: c.lokasi
                )
            }
        }

        // 2. Deadline Tugas
        if prefs.isTaskReminderEnabled {
            let activeTasks = tasks.filter { $0.status != .selesai }
            for t in activeTasks {
                await scheduleReminderForTask(
                    id: t.id,
                    title: t.namaTugas,
                    courseName: t.jadwal?.namaMatkul,
                    deadline: t.deadline
                )
            }
        }

        // 3. Ujian
        if prefs.isExamReminderEnabled {
            let now = Date()
            let upcomingExams = exams.filter { $0.tanggal > now }
            for e in upcomingExams {
                await scheduleReminderForExam(
                    id: e.id,
                    courseName: e.jadwal?.namaMatkul,
                    examType: e.jenisUjian,
                    examDate: e.tanggal,
                    startTime: e.waktuMulai,
                    room: e.ruangan
                )
            }
        }
    }

    // MARK: - Bantuan & Pembersihan

    public func cancelAllReminders() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    private func weekdayNumber(from indonesianDay: String) -> Int {
        switch indonesianDay.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "minggu", "sunday": return 1
        case "senin", "monday": return 2
        case "selasa", "tuesday": return 3
        case "rabu", "wednesday": return 4
        case "kamis", "thursday": return 5
        case "jumat", "jum'at", "friday": return 6
        case "sabtu", "saturday": return 7
        default: return 2
        }
    }
}
