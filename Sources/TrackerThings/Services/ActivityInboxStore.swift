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
/// Menjamin identitas event kanonik, idempotensi pengiriman berulang, pemisahan antara
/// pengingat yang baru tiba (`reminder-*`) dengan ringkasan tenggat (`task-*`),
/// serta pelacakan koordinat tujuan nyata (`inboxTargetRect`) untuk animasi Fly-to-Inbox.
@Observable
@MainActor
public final class ActivityInboxStore {
    public static let shared = ActivityInboxStore()

    private let itemsKey: String
    private let readIdsKey: String
    private let dismissedIdsKey: String
    private let flightDeliveredIdsKey: String
    private let defaults: UserDefaults

    public private(set) var items: [NotificationItem] = []
    private var readIds: Set<String> = []
    private var dismissedIds: Set<String> = []
    private var flightDeliveredIds: Set<String> = []

    // MARK: - Fly-to-Inbox Live State & Spatial Target
    public private(set) var activeFlightItem: NotificationItem? = nil
    public private(set) var flightPhase: FlyToInboxPhase = .idle
    public var flightProgress: CGFloat = 0
    public var badgePulseTrigger: Int = 0
    public var isPresentingInboxSheet: Bool = false

    /// Koordinat nyata target Inbox (GooeyActionDock / Inbox item) dalam ruang koordinat root aplikasi.
    public var inboxTargetRect: CGRect = .zero

    private var flightTask: Task<Void, Never>? = nil

    public init(
        defaults: UserDefaults = .standard,
        keyPrefix: String = "trackerthings_inbox_v1"
    ) {
        self.defaults = defaults
        self.itemsKey = "\(keyPrefix)_items"
        self.readIdsKey = "\(keyPrefix)_read_ids"
        self.dismissedIdsKey = "\(keyPrefix)_dismissed_ids"
        self.flightDeliveredIdsKey = "\(keyPrefix)_flight_delivered_ids"
        loadPersistedState()
    }

    public var unreadCount: Int {
        items.filter { !$0.isRead }.count
    }

    public var hasUrgentUnread: Bool {
        items.contains { !$0.isRead && $0.isUrgent }
    }

    // MARK: - Sinkronisasi Data Akademik Nyata (Idempoten)

    /// Menyinkronkan daftar aktivitas Inbox berdasarkan data akademik nyata dari Dashboard.
    /// Sinkronisasi berulang dengan state yang sama tidak akan menambah duplikat atau mereset status baca.
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
            let itemId = NotificationItem.canonicalId(kind: "academic", entityType: "task", entityId: task.id)
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
                    eventKind: "academic",
                    isRead: readIds.contains(itemId),
                    createdAt: task.deadline
                )
            )
        }

        // 2. Ujian dalam 7 hari ke depan
        for exam in exams where exam.tanggal >= todayStart && exam.tanggal <= sevenDaysLaterEnd {
            let itemId = NotificationItem.canonicalId(kind: "academic", entityType: "exam", entityId: exam.id)
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
                    eventKind: "academic",
                    isRead: readIds.contains(itemId),
                    createdAt: exam.tanggal
                )
            )
        }

        // 3. Kelas Pengganti aktif dalam 2 hari ke depan
        for kp in replacementClasses where kp.status.caseInsensitiveCompare("Selesai") != .orderedSame {
            if kp.tanggal >= todayStart && kp.tanggal < twoDaysLaterEnd {
                let itemId = NotificationItem.canonicalId(kind: "academic", entityType: "replacementClass", entityId: kp.id)
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
                        eventKind: "academic",
                        isRead: readIds.contains(itemId),
                        createdAt: kp.tanggal
                    )
                )
            }
        }

        // Hapus item terkait tugas yang sudah selesai (baik `task-{id}` maupun `reminder-task-{id}`)
        let completedTaskEntityIds = Set(tasks.filter { $0.status == .selesai }.map { $0.id })
        var mergedById: [String: NotificationItem] = [:]

        for existing in items {
            if let eid = existing.entityId, existing.entityType == "task", completedTaskEntityIds.contains(eid) {
                continue
            }
            if completedTaskEntityIds.contains(where: { existing.id == "task-\($0)" || existing.id == "reminder-task-\($0)" || existing.id == "custom-reminder-task-\($0)" }) {
                continue
            }
            guard !dismissedIds.contains(existing.id) else { continue }
            var copy = existing
            copy.isRead = readIds.contains(existing.id)
            mergedById[existing.id] = copy
        }

        for fresh in synced {
            if let prev = mergedById[fresh.id] {
                var updated = fresh
                updated.isRead = readIds.contains(fresh.id) || prev.isRead
                mergedById[fresh.id] = updated
            } else {
                mergedById[fresh.id] = fresh
            }
        }

        self.items = mergedById.values.sorted { lhs, rhs in
            if lhs.isRead != rhs.isRead {
                return !lhs.isRead
            }
            if lhs.isUrgent != rhs.isUrgent {
                return lhs.isUrgent
            }
            if lhs.createdAt != rhs.createdAt {
                return lhs.createdAt > rhs.createdAt
            }
            return lhs.id < rhs.id
        }

        savePersistedState()
    }

    // MARK: - Enqueue Arrival & True Anchored Fly-to-Inbox Choreography

    /// Mencatat item aktivitas baru secara idempoten dan memicu animasi Fly-to-Inbox
    /// hanya sekali untuk setiap ID event kanonik.
    public func enqueueArrival(
        _ item: NotificationItem,
        triggerFlight: Bool = true,
        reduceMotion: Bool = false
    ) {
        let canonicalId = item.id

        // Jika item dengan ID kanonik ini sudah dihapus pengguna (dan bukan pengingat baru yang berbeda ID),
        // hormati pilihan pengguna kecuali pengguna baru saja membuat item baru (`eventKind == "created"`).
        if item.eventKind == "created" {
            dismissedIds.remove(canonicalId)
            readIds.remove(canonicalId)
            flightDeliveredIds.remove(canonicalId)
        } else if dismissedIds.contains(canonicalId) {
            return
        }

        let wasAlreadyRead = readIds.contains(canonicalId)
        let alreadyDeliveredFlight = flightDeliveredIds.contains(canonicalId)

        var storedItem = item
        storedItem.isRead = wasAlreadyRead

        if let idx = items.firstIndex(where: { $0.id == canonicalId }) {
            items[idx] = storedItem
        } else {
            items.insert(storedItem, at: 0)
        }

        // Pastikan penyimpanan persisten dilakukan SEBELUM animasi dimulai sehingga
        // interupsi animasi, perpindahan tab, atau backgrounding tidak pernah menghilangkan data.
        let shouldAnimateFlight = triggerFlight && !alreadyDeliveredFlight && !isPresentingInboxSheet
        if shouldAnimateFlight {
            flightDeliveredIds.insert(canonicalId)
        }
        savePersistedState()

        guard shouldAnimateFlight else {
            if !alreadyDeliveredFlight {
                flightDeliveredIds.insert(canonicalId)
                savePersistedState()
                badgePulseTrigger &+= 1
            }
            return
        }

        // Batalkan animasi terbang sebelumnya dengan aman tanpa menghapus data
        flightTask?.cancel()
        activeFlightItem = storedItem
        flightProgress = 0

        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.inboxArrival, reduceMotion: reduceMotion)) {
            flightPhase = .entering
        }

        flightTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 140_000_000)
            guard !Task.isCancelled else { return }
            flightPhase = .holding

            try? await Task.sleep(nanoseconds: 1_550_000_000)
            guard !Task.isCancelled else { return }

            if reduceMotion {
                withAnimation(AppTheme.Motion.reducedMotionFallback) {
                    flightPhase = .landed
                    flightProgress = 1.0
                    activeFlightItem = nil
                    badgePulseTrigger &+= 1
                }
                flightPhase = .idle
                flightProgress = 0
            } else {
                withAnimation(AppTheme.Motion.inboxFlight) {
                    flightPhase = .flyingToInbox
                    flightProgress = 1.0
                }
                try? await Task.sleep(nanoseconds: 400_000_000)
                guard !Task.isCancelled else { return }

                withAnimation(AppTheme.Motion.badgePulse) {
                    flightPhase = .landed
                    badgePulseTrigger &+= 1
                    activeFlightItem = nil
                }
                HapticsHelper.impact(.light)

                try? await Task.sleep(nanoseconds: 220_000_000)
                guard !Task.isCancelled else { return }
                flightPhase = .idle
                flightProgress = 0
            }
        }
    }

    /// Menghentikan animasi terbang secara aman (saat pengguna mengetuk tutup, membuka Inbox,
    /// berpindah ke background, atau view menghilang). Data tetap tersimpan utuh di Inbox.
    public func dismissActiveFlight(reduceMotion: Bool = false) {
        flightTask?.cancel()
        flightTask = nil
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelDismiss, reduceMotion: reduceMotion)) {
            activeFlightItem = nil
            flightPhase = .idle
            flightProgress = 0
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
        flightTask = nil
        items.removeAll()
        readIds.removeAll()
        dismissedIds.removeAll()
        flightDeliveredIds.removeAll()
        activeFlightItem = nil
        flightPhase = .idle
        flightProgress = 0
        defaults.removeObject(forKey: itemsKey)
        defaults.removeObject(forKey: readIdsKey)
        defaults.removeObject(forKey: dismissedIdsKey)
        defaults.removeObject(forKey: flightDeliveredIdsKey)
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
        if let deliveredArr = defaults.stringArray(forKey: flightDeliveredIdsKey) {
            flightDeliveredIds = Set(deliveredArr)
        }
        if let data = defaults.data(forKey: itemsKey),
           let decoded = try? JSONDecoder().decode([NotificationItem].self, from: data) {
            var uniqueById: [String: NotificationItem] = [:]
            for item in decoded where !dismissedIds.contains(item.id) {
                var copy = item
                copy.isRead = readIds.contains(item.id) || item.isRead
                uniqueById[copy.id] = copy
            }
            items = Array(uniqueById.values).sorted { lhs, rhs in
                if lhs.isRead != rhs.isRead { return !lhs.isRead }
                if lhs.isUrgent != rhs.isUrgent { return lhs.isUrgent }
                return lhs.createdAt > rhs.createdAt
            }
        }
    }

    private func savePersistedState() {
        defaults.set(Array(readIds), forKey: readIdsKey)
        defaults.set(Array(dismissedIds), forKey: dismissedIdsKey)
        defaults.set(Array(flightDeliveredIds), forKey: flightDeliveredIdsKey)
        if let data = try? JSONEncoder().encode(items) {
            defaults.set(data, forKey: itemsKey)
        }
    }
}
