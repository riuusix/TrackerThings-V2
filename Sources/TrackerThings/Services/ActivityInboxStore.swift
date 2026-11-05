import Foundation
import SwiftUI

/// Fase animasi untuk pengalaman kedatangan notifikasi "Fly-to-Inbox".
public enum FlyToInboxPhase: String, Sendable, Equatable {
    case idle
    case entering
    case holding
    case flyingToInbox
    case landed
}

/// Penyimpanan dan koordinator In-App Activity Inbox yang persisten.
/// Menggabungkan pengingat akademik nyata (tugas mendesak, ujian terdekat, kelas pengganti)
/// serta event notifikasi foreground `UNUserNotificationCenter` tanpa membuat data palsu.
@Observable
@MainActor
public final class ActivityInboxStore {
    public static let shared = ActivityInboxStore()

    private let itemsKey: String
    private let readIdsKey: String
    private let dismissedIdsKey: String
    private let defaults: UserDefaults

    public private(set) var items: [NotificationItem] = []
    private var readIds: Set<String> = []
    private var dismissedIds: Set<String> = []

    // MARK: - Fly-to-Inbox Live State
    public private(set) var activeFlightItem: NotificationItem? = nil
    public private(set) var flightPhase: FlyToInboxPhase = .idle
    public var badgePulseTrigger: Int = 0
    public var isPresentingInboxSheet: Bool = false

    private var flightTask: Task<Void, Never>? = nil

    public init(
        defaults: UserDefaults = .standard,
        keyPrefix: String = "trackerthings_inbox_v1"
    ) {
        self.defaults = defaults
        self.itemsKey = "\(keyPrefix)_items"
        self.readIdsKey = "\(keyPrefix)_read_ids"
        self.dismissedIdsKey = "\(keyPrefix)_dismissed_ids"
        loadPersistedState()
    }

    public var unreadCount: Int {
        items.filter { !$0.isRead }.count
    }

    public var hasUrgentUnread: Bool {
        items.contains { !$0.isRead && $0.isUrgent }
    }

    // MARK: - Sinkronisasi Data Akademik Nyata

    /// Menyinkronkan daftar aktivitas Inbox berdasarkan data akademik nyata dari Dashboard.
    public func syncWithAcademicState(
        tasks: [TugasItem],
        exams: [UjianItem],
        replacementClasses: [KelasPenggantiItem] = []
    ) {
        let now = Date()
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: now)
        let twoDaysLaterEnd = calendar.date(byAdding: .day, value: 3, to: todayStart) ?? now
        let sevenDaysLaterEnd = calendar.date(byAdding: .day, value: 7, to: todayStart) ?? now

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "id_ID")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none

        var synced: [NotificationItem] = []

        // 1. Tugas aktif yang mendesak (<= 2 hari atau terlewat)
        for task in tasks where task.status != .selesai && task.deadline < twoDaysLaterEnd {
            let itemId = "task-\(task.id)"
            guard !dismissedIds.contains(itemId) else { continue }
            let isOverdue = task.deadline < todayStart
            let timeLabel = isOverdue
                ? "Terlewat • \(formatter.string(from: task.deadline))"
                : "Tenggat • \(formatter.string(from: task.deadline))"

            synced.append(
                NotificationItem(
                    id: itemId,
                    judul: task.namaTugas,
                    namaMatkul: task.jadwal?.namaMatkul ?? "Tugas Akademik",
                    waktu: timeLabel,
                    tipe: .tugas,
                    isUrgent: isOverdue || task.prioritas == .tinggi,
                    entityType: "task",
                    entityId: task.id,
                    isRead: readIds.contains(itemId),
                    createdAt: task.deadline
                )
            )
        }

        // 2. Ujian dalam 7 hari ke depan
        for exam in exams where exam.tanggal >= todayStart && exam.tanggal <= sevenDaysLaterEnd {
            let itemId = "exam-\(exam.id)"
            guard !dismissedIds.contains(itemId) else { continue }
            let timePart = exam.waktuMulai.map { " • \($0)" } ?? ""
            synced.append(
                NotificationItem(
                    id: itemId,
                    judul: "\(exam.jenisUjian): \(exam.jadwal?.namaMatkul ?? "Ujian")",
                    namaMatkul: exam.ruangan.map { "Ruang \($0)" } ?? "Jadwal Evaluasi",
                    waktu: "\(formatter.string(from: exam.tanggal))\(timePart)",
                    tipe: .ujian,
                    isUrgent: true,
                    entityType: "exam",
                    entityId: exam.id,
                    isRead: readIds.contains(itemId),
                    createdAt: exam.tanggal
                )
            )
        }

        // 3. Kelas Pengganti aktif dalam 2 hari ke depan
        for kp in replacementClasses where kp.status.caseInsensitiveCompare("Selesai") != .orderedSame {
            if kp.tanggal >= todayStart && kp.tanggal < twoDaysLaterEnd {
                let itemId = "replacement-\(kp.id)"
                guard !dismissedIds.contains(itemId) else { continue }
                synced.append(
                    NotificationItem(
                        id: itemId,
                        judul: "Kelas Pengganti: \(kp.jadwal?.namaMatkul ?? "Kuliah")",
                        namaMatkul: kp.lokasi ?? "Ruang Kuliah",
                        waktu: "\(formatter.string(from: kp.tanggal)) • \(kp.waktuMulai)",
                        tipe: .pengganti,
                        isUrgent: false,
                        entityType: "replacementClass",
                        entityId: kp.id,
                        isRead: readIds.contains(itemId),
                        createdAt: kp.tanggal
                    )
                )
            }
        }

        // Gabungkan dengan event aktivitas yang sudah terekam (misal dari pengingat foreground atau aksi baru),
        // tetapi hapus item tugas yang sudah selesai.
        let completedTaskIds = Set(tasks.filter { $0.status == .selesai }.map { "task-\($0.id)" })
        var mergedById: [String: NotificationItem] = [:]

        for existing in items where !completedTaskIds.contains(existing.id) && !dismissedIds.contains(existing.id) {
            var copy = existing
            copy.isRead = readIds.contains(existing.id)
            mergedById[existing.id] = copy
        }

        for fresh in synced {
            mergedById[fresh.id] = fresh
        }

        self.items = mergedById.values.sorted { lhs, rhs in
            if lhs.isRead != rhs.isRead {
                return !lhs.isRead
            }
            if lhs.isUrgent != rhs.isUrgent {
                return lhs.isUrgent
            }
            return lhs.createdAt > rhs.createdAt
        }

        savePersistedState()
    }

    // MARK: - Enqueue Arrival & Fly-to-Inbox Choreography

    /// Mencatat item aktivitas baru dan opsional memicu animasi Fly-to-Inbox.
    public func enqueueArrival(
        _ item: NotificationItem,
        triggerFlight: Bool = true,
        reduceMotion: Bool = false
    ) {
        dismissedIds.remove(item.id)
        readIds.remove(item.id)

        var unreadItem = item
        unreadItem.isRead = false

        if let idx = items.firstIndex(where: { $0.id == unreadItem.id }) {
            items[idx] = unreadItem
        } else {
            items.insert(unreadItem, at: 0)
        }
        savePersistedState()

        guard triggerFlight else {
            badgePulseTrigger &+= 1
            return
        }

        flightTask?.cancel()
        activeFlightItem = unreadItem

        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.inboxArrival, reduceMotion: reduceMotion)) {
            flightPhase = .entering
        }

        flightTask = Task { @MainActor in
            // Fase 1: Muncul & dapat dibaca (1.8 detik)
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            flightPhase = .holding

            try? await Task.sleep(nanoseconds: 1_650_000_000)
            guard !Task.isCancelled else { return }

            // Fase 2: Terbang menuju ikon Inbox
            if reduceMotion {
                withAnimation(AppTheme.Motion.reducedMotionFallback) {
                    flightPhase = .landed
                    activeFlightItem = nil
                    badgePulseTrigger &+= 1
                }
                flightPhase = .idle
            } else {
                withAnimation(AppTheme.Motion.inboxFlight) {
                    flightPhase = .flyingToInbox
                }
                try? await Task.sleep(nanoseconds: 380_000_000)
                guard !Task.isCancelled else { return }

                withAnimation(AppTheme.Motion.badgePulse) {
                    flightPhase = .landed
                    badgePulseTrigger &+= 1
                    activeFlightItem = nil
                }
                HapticsHelper.impact(.light)

                try? await Task.sleep(nanoseconds: 250_000_000)
                guard !Task.isCancelled else { return }
                flightPhase = .idle
            }
        }
    }

    /// Membatalkan animasi terbang yang sedang berlangsung (misal diketuk atau ditutup pengguna).
    public func dismissActiveFlight(reduceMotion: Bool = false) {
        flightTask?.cancel()
        flightTask = nil
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelDismiss, reduceMotion: reduceMotion)) {
            activeFlightItem = nil
            flightPhase = .idle
        }
    }

    // MARK: - Read / Dismiss / Open Actions

    public func markAsRead(id: String) {
        readIds.insert(id)
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx].isRead = true
        }
        savePersistedState()
    }

    public func markAllAsRead() {
        for index in items.indices {
            items[index].isRead = true
            readIds.insert(items[index].id)
        }
        savePersistedState()
    }

    public func dismissItem(id: String) {
        dismissedIds.insert(id)
        items.removeAll { $0.id == id }
        savePersistedState()
    }

    public func clearReadItems() {
        let toRemove = items.filter { $0.isRead }.map { $0.id }
        for id in toRemove {
            dismissedIds.insert(id)
        }
        items.removeAll { $0.isRead }
        savePersistedState()
    }

    public func resetAllForTesting() {
        flightTask?.cancel()
        items.removeAll()
        readIds.removeAll()
        dismissedIds.removeAll()
        activeFlightItem = nil
        flightPhase = .idle
        defaults.removeObject(forKey: itemsKey)
        defaults.removeObject(forKey: readIdsKey)
        defaults.removeObject(forKey: dismissedIdsKey)
    }

    /// Menandai item sudah dibaca lalu melakukan navigasi ke rute detail terkait.
    public func openItem(_ item: NotificationItem) {
        markAsRead(id: item.id)
        dismissActiveFlight()
        isPresentingInboxSheet = false

        if let route = item.route {
            AppNavigationCoordinator.shared.navigate(to: route)
        } else if let entityType = item.entityType {
            let payload = NotificationPayload(entityType: entityType, entityId: item.entityId ?? 0)
            AppNavigationCoordinator.shared.handleNotificationPayload(payload)
        }
    }

    // MARK: - Persistence

    private func loadPersistedState() {
        if let readArr = defaults.stringArray(forKey: readIdsKey) {
            readIds = Set(readArr)
        }
        if let dismissedArr = defaults.stringArray(forKey: dismissedIdsKey) {
            dismissedIds = Set(dismissedArr)
        }
        if let data = defaults.data(forKey: itemsKey),
           let decoded = try? JSONDecoder().decode([NotificationItem].self, from: data) {
            items = decoded.filter { !dismissedIds.contains($0.id) }.map { item in
                var copy = item
                copy.isRead = readIds.contains(item.id) || item.isRead
                return copy
            }
        }
    }

    private func savePersistedState() {
        defaults.set(Array(readIds), forKey: readIdsKey)
        defaults.set(Array(dismissedIds), forKey: dismissedIdsKey)
        if let data = try? JSONEncoder().encode(items) {
            defaults.set(data, forKey: itemsKey)
        }
    }
}
