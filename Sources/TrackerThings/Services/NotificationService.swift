import Foundation
import UserNotifications
import os

private let logger = Logger(subsystem: "com.trackerthings.app", category: "Notifications")

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
/// serta menangani interaksi pengguna saat banner diketuk.
private final class LocalNotificationPresentationDelegate: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
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
        let userInfo = response.notification.request.content.userInfo
        if let destination = userInfo["destination"] as? String {
            logger.info("Notification tapped with destination: \(destination, privacy: .public)")
            // Simpan pendingDestination agar dapat dikonsumsi saat cold-start
            NotificationService.shared.pendingDestination = destination
            NotificationService.shared.pendingUserInfo = userInfo
            await MainActor.run {
                NotificationCenter.default.post(
                    name: .openTrackerThingsDestination,
                    object: nil,
                    userInfo: userInfo
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
/// logging diagnostik terstruktur, dan pembatalan pintar saat jadwal berubah atau dihapus.
public final class NotificationService: Sendable {
    public static let shared = NotificationService()

    private let destinationLock = NSLock()
    private final class PendingStorage: @unchecked Sendable {
        var destination: String? = nil
        var userInfo: [AnyHashable: Any]? = nil
    }
    private let storage = PendingStorage()

    /// Menyimpan tujuan navigasi notifikasi terakhir (berguna untuk mengatasi race condition cold-start)
    public var pendingDestination: String? {
        get {
            destinationLock.lock()
            defer { destinationLock.unlock() }
            return storage.destination
        }
        set {
            destinationLock.lock()
            defer { destinationLock.unlock() }
            storage.destination = newValue
        }
    }

    /// Mengambil dan menghapus tujuan navigasi notifikasi pending secara atomik
    public var pendingUserInfo: [AnyHashable: Any]? {
        get {
            destinationLock.lock()
            defer { destinationLock.unlock() }
            return storage.userInfo
        }
        set {
            destinationLock.lock()
            defer { destinationLock.unlock() }
            storage.userInfo = newValue
        }
    }

    /// Mengambil dan menghapus tujuan navigasi notifikasi pending secara atomik
    public func consumePendingDestination() -> String? {
        destinationLock.lock()
        defer { destinationLock.unlock() }
        let current = storage.destination
        storage.destination = nil
        storage.userInfo = nil
        return current
    }

    /// Mengambil seluruh paket tujuan dan payload notifikasi pending secara atomik
    public func consumePendingNotification() -> (destination: String, userInfo: [AnyHashable: Any])? {
        destinationLock.lock()
        defer { destinationLock.unlock() }
        guard let dest = storage.destination else { return nil }
        let uInfo = storage.userInfo ?? [:]
        storage.destination = nil
        storage.userInfo = nil
        return (dest, uInfo)
    }

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
            logger.info("Notification authorization request result: \(granted, privacy: .public)")
            return granted
        } catch {
            logger.error("Notification authorization request error: \(error.localizedDescription, privacy: .public)")
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
            logger.info("Task reminder disabled by preferences for task-\(id, privacy: .public)")
            cancelReminderForTask(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else {
            logger.warning("Notification permission not granted for task-\(id, privacy: .public)")
            return
        }

        let now = Date()
        let calendar = Calendar.current
        let hour = calendar.component(.hour, from: deadline)
        let minute = calendar.component(.minute, from: deadline)

        // Jika waktu deadline adalah tanggal kalender (jam 00:00:00),
        // batas akhir tugas adalah akhir hari (23:59:00) pada zona waktu lokal perangkat.
        let effectiveDeadline: Date
        if hour == 0 && minute == 0 {
            effectiveDeadline = calendar.date(bySettingHour: 23, minute: 59, second: 0, of: deadline) ?? deadline
        } else {
            effectiveDeadline = deadline
        }

        // Jika deadline sudah lewat dari waktu saat ini, batalkan pengingat dan jangan jadwalkan apa pun
        guard effectiveDeadline > now else {
            logger.info("Task-\(id, privacy: .public) deadline has passed. Cancelling reminder.")
            cancelReminderForTask(id: id)
            return
        }

        let reminderDate: Date
        let reminderType: String

        let hMinus1 = effectiveDeadline.addingTimeInterval(-86400) // H-1 (24 jam sebelum deadline)
        let hMinus2 = effectiveDeadline.addingTimeInterval(-7200)  // H-2 jam sebelum deadline

        if hMinus1 > now {
            reminderDate = hMinus1
            reminderType = "H-1"
        } else if hMinus2 > now {
            reminderDate = hMinus2
            reminderType = "H-2h"
        } else if effectiveDeadline.timeIntervalSince(now) >= 120 {
            // Fallback hari H: sisa waktu kurang dari 2 jam tetapi masih lebih dari 2 menit
            reminderDate = now.addingTimeInterval(60)
            reminderType = "Fallback-Hari-H"
        } else {
            // Waktu tersisa kurang dari 2 menit menuju deadline, tidak perlu menjadwalkan notifikasi baru
            logger.info("Task-\(id, privacy: .public) is less than 2 minutes from deadline. Skipping reminder.")
            return
        }

        let coursePrefix = courseName.map { "[\($0)] " } ?? ""
        let body = "\(coursePrefix)Tugas \"\(title)\" mendekati tenggat waktu pengumpulan."

        let content = UNMutableNotificationContent()
        content.title = "Pengingat Tugas TrackerThings"
        content.body = body
        content.sound = .default
        content.badge = 1
        content.userInfo = ["destination": "tasks", "taskId": id]

        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: reminderDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "task-\(id)",
            content: content,
            trigger: trigger
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            logger.info("Scheduled task reminder [\(reminderType, privacy: .public)] for task-\(id, privacy: .public) at \(reminderDate.description, privacy: .public)")
        } catch {
            logger.error("Failed to add notification request task-\(id, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
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
            logger.info("Class reminder disabled by preferences for course-\(id, privacy: .public)")
            cancelReminderForCourse(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else {
            logger.warning("Notification permission not granted for course-\(id, privacy: .public)")
            return
        }

        // Parsing waktu "HH:mm"
        let parts = startTime.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else {
            logger.warning("Invalid start time '\(startTime, privacy: .public)' for course-\(id, privacy: .public)")
            return
        }

        let weekday = weekdayNumber(from: dayOfWeek)
        guard weekday >= 1 && weekday <= 7 else {
            logger.warning("Invalid day of week '\(dayOfWeek, privacy: .public)' for course-\(id, privacy: .public)")
            return
        }

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

        dateComponents.timeZone = Calendar.current.timeZone
        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)

        let request = UNNotificationRequest(
            identifier: "course-\(id)",
            content: content,
            trigger: trigger
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            logger.info("Scheduled recurring course reminder for course-\(id, privacy: .public) on weekday \(targetWeekday) at \(reminderHour):\(reminderMinute)")
        } catch {
            logger.error("Failed to add notification request course-\(id, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
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
            logger.info("Exam reminder disabled by preferences for exam-\(id, privacy: .public)")
            cancelReminderForExam(id: id)
            return
        }

        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else {
            logger.warning("Notification permission not granted for exam-\(id, privacy: .public)")
            return
        }

        let now = Date()
        let calendar = Calendar.current
        var effectiveExamDate = examDate
        if let start = startTime, let (h, m) = parseHourMinute(start) {
            effectiveExamDate = calendar.date(bySettingHour: h, minute: m, second: 0, of: examDate) ?? examDate
        } else {
            effectiveExamDate = calendar.date(bySettingHour: 8, minute: 0, second: 0, of: examDate) ?? examDate
        }

        guard effectiveExamDate > now else {
            logger.info("Exam-\(id, privacy: .public) has already passed. Cancelling reminder.")
            cancelReminderForExam(id: id)
            return
        }

        let triggerDate: Date
        let reminderType: String

        let leadTimeTrigger = effectiveExamDate.addingTimeInterval(-Double(prefs.examLeadTimeHours * 3600))
        let hMinus2 = effectiveExamDate.addingTimeInterval(-7200)

        if leadTimeTrigger > now {
            triggerDate = leadTimeTrigger
            reminderType = "H-1"
        } else if hMinus2 > now {
            triggerDate = hMinus2
            reminderType = "H-2h"
        } else if effectiveExamDate.timeIntervalSince(now) >= 120 {
            // Fallback hari H: sisa waktu kurang dari 2 jam menuju ujian tetapi masih lebih dari 2 menit
            triggerDate = now.addingTimeInterval(60)
            reminderType = "Fallback-Hari-H"
        } else {
            // Ujian dimulai kurang dari 2 menit, tidak perlu menjadwalkan notifikasi baru
            logger.info("Exam-\(id, privacy: .public) is less than 2 minutes from start. Skipping reminder.")
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

        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: triggerDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "exam-\(id)",
            content: content,
            trigger: trigger
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            logger.info("Scheduled exam reminder [\(reminderType, privacy: .public)] for exam-\(id, privacy: .public) at \(triggerDate.description, privacy: .public)")
        } catch {
            logger.error("Failed to add notification request exam-\(id, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    public func cancelReminderForExam(id: Int) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["exam-\(id)"])
    }

    // MARK: - Sinkronisasi Menyeluruh (Deduplikasi Bersih & Pembersihan Stale)

    public func syncAllReminders(
        courses: [JadwalItem],
        tasks: [TugasItem],
        exams: [UjianItem]
    ) async {
        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else {
            logger.warning("Skipping syncAllReminders: notifications not authorized")
            return
        }

        let prefs = getPreferences()
        let center = UNUserNotificationCenter.current()
        let pendingRequests = await center.pendingNotificationRequests()

        // 1. Jadwal Kuliah
        let validCourseIds = Set(courses.map { "course-\($0.id)" })
        let staleCourseIds = pendingRequests
            .filter { $0.identifier.hasPrefix("course-") && !validCourseIds.contains($0.identifier) }
            .map { $0.identifier }
        if !staleCourseIds.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: staleCourseIds)
            logger.info("Cleaned up \(staleCourseIds.count, privacy: .public) stale course reminders")
        }

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
        } else {
            let allCourseNotifs = pendingRequests.filter { $0.identifier.hasPrefix("course-") }.map { $0.identifier }
            center.removePendingNotificationRequests(withIdentifiers: allCourseNotifs)
        }

        // 2. Deadline Tugas
        let activeTasks = tasks.filter { $0.status != .selesai }
        let validTaskIds = Set(activeTasks.map { "task-\($0.id)" })
        let staleTaskIds = pendingRequests
            .filter { $0.identifier.hasPrefix("task-") && !validTaskIds.contains($0.identifier) }
            .map { $0.identifier }
        if !staleTaskIds.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: staleTaskIds)
            logger.info("Cleaned up \(staleTaskIds.count, privacy: .public) stale task reminders")
        }

        if prefs.isTaskReminderEnabled {
            for t in activeTasks {
                await scheduleReminderForTask(
                    id: t.id,
                    title: t.namaTugas,
                    courseName: t.jadwal?.namaMatkul,
                    deadline: t.deadline
                )
            }
        } else {
            let allTaskNotifs = pendingRequests.filter { $0.identifier.hasPrefix("task-") }.map { $0.identifier }
            center.removePendingNotificationRequests(withIdentifiers: allTaskNotifs)
        }

        // 3. Ujian
        let now = Date()
        let upcomingExams = exams.filter { $0.tanggal >= Calendar.current.startOfDay(for: now) }
        let validExamIds = Set(upcomingExams.map { "exam-\($0.id)" })
        let staleExamIds = pendingRequests
            .filter { $0.identifier.hasPrefix("exam-") && !validExamIds.contains($0.identifier) }
            .map { $0.identifier }
        if !staleExamIds.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: staleExamIds)
            logger.info("Cleaned up \(staleExamIds.count, privacy: .public) stale exam reminders")
        }

        if prefs.isExamReminderEnabled {
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
        } else {
            let allExamNotifs = pendingRequests.filter { $0.identifier.hasPrefix("exam-") }.map { $0.identifier }
            center.removePendingNotificationRequests(withIdentifiers: allExamNotifs)
        }

        logger.info("syncAllReminders completed successfully")
    }

    /// Membaca data terbaru dari LocalCacheService lalu menjalankan sinkronisasi notifikasi
    public func syncRemindersFromCache() async {
        let courses: [JadwalItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyJadwal) ?? []
        let tasks: [TugasItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyTugas) ?? []
        let exams: [UjianItem] = LocalCacheService.shared.load(forKey: LocalCacheService.keyUjian) ?? []
        await syncAllReminders(courses: courses, tasks: tasks, exams: exams)
    }

    // MARK: - Diagnostik & Pengujian Notifikasi Cepat

    @discardableResult
    public func scheduleTestNotification(
        delaySeconds: TimeInterval,
        category: String,
        destination: String
    ) async -> Bool {
        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else {
            logger.warning("Cannot schedule test notification: notifications not authorized")
            return false
        }

        let content = UNMutableNotificationContent()
        content.title = "[TEST] Pengingat \(category) TrackerThings"
        content.body = "Ini adalah notifikasi uji (\(Int(delaySeconds))s). Mengetuk notifikasi ini akan membuka tab \(category)."
        content.sound = .default
        content.badge = 1
        content.userInfo = ["destination": destination, "isTestNotification": true]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, delaySeconds), repeats: false)
        let request = UNNotificationRequest(
            identifier: "test-notification-\(destination)",
            content: content,
            trigger: trigger
        )

        do {
            try await UNUserNotificationCenter.current().add(request)
            logger.info("Successfully scheduled test notification for \(destination, privacy: .public) in \(delaySeconds, privacy: .public)s")
            return true
        } catch {
            logger.error("Failed to schedule test notification: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    // MARK: - Bantuan & Pembersihan

    public func cancelAllReminders() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        logger.info("All pending reminders have been cancelled")
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

    private func parseHourMinute(_ timeStr: String) -> (Int, Int)? {
        let parts = timeStr.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: ":")
        guard parts.count >= 2,
              let h = Int(parts[0]),
              let m = Int(parts[1]) else { return nil }
        return (h, m)
    }
}
