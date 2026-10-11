import Foundation
import UserNotifications

/// Delegate internal untuk menangani presentasi notifikasi saat aplikasi berada di latar depan (foreground)
private final class LocalNotificationPresentationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = LocalNotificationPresentationDelegate()

    // Menampilkan banner, badge, dan memutar suara meskipun aplikasi sedang terbuka di layar
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
        // Handle interaksi pengguna saat banner diketuk
    }
}

/// Layanan manajemen notifikasi lokal menggunakan UserNotifications framework.
/// Mendukung izin, foreground banner presentation, penjadwalan pengingat deadline tugas & ujian, serta pembatalan.
public final class NotificationService: Sendable {
    public static let shared = NotificationService()

    private init() {
        // Konfigurasi delegate agar notifikasi tetap tampil di foreground
        UNUserNotificationCenter.current().delegate = LocalNotificationPresentationDelegate.shared
    }

    /// Memastikan delegate aktif terpasang
    public func configureForegroundPresentation() {
        UNUserNotificationCenter.current().delegate = LocalNotificationPresentationDelegate.shared
    }

    /// Meminta izin notifikasi dari pengguna (Alert, Badge, Sound)
    @discardableResult
    public func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            center.delegate = LocalNotificationPresentationDelegate.shared
            return granted
        } catch {
            print("Gagal meminta izin notifikasi:", error.localizedDescription)
            return false
        }
    }

    /// Memeriksa status izin notifikasi saat ini
    public func checkAuthorizationStatus() async -> UNAuthorizationStatus {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        return settings.authorizationStatus
    }

    /// Menjadwalkan pengingat lokal untuk deadline tugas secara otomatis
    public func scheduleReminderForTask(
        id: Int,
        title: String,
        courseName: String?,
        deadline: Date
    ) async {
        let status = await checkAuthorizationStatus()
        guard status == .authorized || status == .ephemeral || status == .provisional else { return }

        let now = Date()
        guard deadline > now else { return }

        // Jadwalkan 1 hari sebelum deadline jika memungkinkan, atau 2 jam sebelumnya jika waktu kurang dari 1 hari
        var reminderDate = deadline.addingTimeInterval(-86400) // H-1
        if reminderDate <= now {
            reminderDate = deadline.addingTimeInterval(-7200) // H-2 jam
        }
        if reminderDate <= now {
            reminderDate = now.addingTimeInterval(60) // 1 menit dari sekarang jika tenggat sangat dekat
        }

        let coursePrefix = courseName.map { "[\($0)] " } ?? ""
        let body = "\(coursePrefix)Tugas \"\(title)\" mendekati batas waktu pengumpulan!"

        await scheduleTaskReminder(
            id: "\(id)",
            title: "Pengingat Tugas TrackerThings",
            body: body,
            triggerDate: reminderDate
        )
    }

    /// Menjadwalkan pengingat lokal kustom dengan tanggal trigger tertentu
    public func scheduleTaskReminder(
        id: String,
        title: String,
        body: String,
        triggerDate: Date
    ) async {
        let center = UNUserNotificationCenter.current()
        center.delegate = LocalNotificationPresentationDelegate.shared

        // Pastikan waktu pengingat berada di masa mendatang
        guard triggerDate > Date() else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = 1

        let components = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: triggerDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

        let request = UNNotificationRequest(
            identifier: "task-reminder-\(id)",
            content: content,
            trigger: trigger
        )

        do {
            try await center.add(request)
        } catch {
            print("Gagal menjadwalkan notifikasi:", error.localizedDescription)
        }
    }

    /// Membatalkan notifikasi tugas tertentu
    public func cancelReminderForTask(id: Int) {
        cancelReminder(id: "\(id)")
    }

    /// Membatalkan notifikasi berdasarkan ID pengingat
    public func cancelReminder(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["task-reminder-\(id)"])
    }

    /// Menghapus semua notifikasi pengingat yang tertunda
    public func cancelAllReminders() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}
