import XCTest
import SwiftUI
@testable import TrackerThings

final class InteractiveRedesignTests: XCTestCase {

    // MARK: - 1. Gooey Action Dock & Morphing Quick Composer State Machine

    @MainActor
    func testQuickActionDockControllerStateTransitions() {
        let controller = QuickActionDockController()
        XCTAssertFalse(controller.isExpanded)
        XCTAssertNil(controller.activeComposer)

        // Expand dock
        controller.toggleDock(reduceMotion: true)
        XCTAssertTrue(controller.isExpanded)
        XCTAssertNil(controller.activeComposer)

        // Select action -> morphs dock into active composer and collapses menu pills
        controller.selectAction(.task, reduceMotion: true)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.activeComposer, .task)

        // Switch mode inside composer
        controller.selectAction(.exam, reduceMotion: true)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.activeComposer, .exam)

        // Dismiss composer -> returns cleanly to resting state
        controller.dismissComposer(reduceMotion: true)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertNil(controller.activeComposer)

        // Reset immediate on tab change
        controller.toggleDock(reduceMotion: true)
        XCTAssertTrue(controller.isExpanded)
        controller.resetStateImmediate()
        XCTAssertFalse(controller.isExpanded)
        XCTAssertNil(controller.activeComposer)
    }

    // MARK: - 2. Activity Inbox Store & Fly-to-Inbox Persistence / Routing

    @MainActor
    func testActivityInboxStorePersistenceAndReadLifecycle() {
        let suiteName = "com.trackerthings.tests.inbox.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ActivityInboxStore(defaults: defaults)
        XCTAssertEqual(store.items.count, 0)
        XCTAssertEqual(store.unreadCount, 0)

        let item1 = NotificationItem(
            id: "task-201",
            judul: "Implementasi B-Tree",
            namaMatkul: "Struktur Data",
            waktu: "Besok",
            tipe: .tugas,
            isUrgent: true,
            entityType: "task",
            entityId: 201
        )
        store.enqueueArrival(item1, triggerFlight: false)

        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.unreadCount, 1)
        XCTAssertTrue(store.hasUrgentUnread)
        XCTAssertEqual(store.items.first?.route, .taskDetail(id: 201))

        // Mark as read
        store.markAsRead(id: "task-201")
        XCTAssertEqual(store.unreadCount, 0)
        XCTAssertFalse(store.hasUrgentUnread)

        // Verify persistence across store re-initialization
        let reloadedStore = ActivityInboxStore(defaults: defaults)
        XCTAssertEqual(reloadedStore.items.count, 1)
        XCTAssertEqual(reloadedStore.unreadCount, 0)
        XCTAssertTrue(reloadedStore.items.first?.isRead == true)

        // Dismiss item and ensure it stays dismissed
        reloadedStore.dismissItem(id: "task-201")
        XCTAssertEqual(reloadedStore.items.count, 0)
    }

    @MainActor
    func testActivityInboxSyncWithAcademicState() {
        let suiteName = "com.trackerthings.tests.sync.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ActivityInboxStore(defaults: defaults)
        let now = Date()
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!

        let urgentTask = TugasItem(
            id: 301,
            idJadwal: 10,
            namaTugas: "Laporan Akhir Praktikum",
            deadline: tomorrow,
            prioritas: .tinggi,
            jenis: .individu,
            status: .sedangDikerjakan,
            progress: 50,
            jadwal: CourseInfo(namaMatkul: "Jaringan Komputer")
        )

        let upcomingExam = UjianItem(
            id: 401,
            idJadwal: 10,
            jenisUjian: "UTS",
            tanggal: tomorrow,
            waktuMulai: "09:00",
            waktuSelesai: "11:00",
            ruangan: "R.301",
            catatan: nil,
            jadwal: CourseInfo(namaMatkul: "Jaringan Komputer")
        )

        store.syncWithAcademicState(
            tasks: [urgentTask],
            exams: [upcomingExam],
            replacementClasses: []
        )

        XCTAssertEqual(store.items.count, 2)
        XCTAssertTrue(store.items.contains(where: { $0.id == "task-301" && $0.route == .taskDetail(id: 301) }))
        XCTAssertTrue(store.items.contains(where: { $0.id == "exam-401" && $0.route == .examDetail(id: 401) }))
    }

    // MARK: - 3. NotificationItem Backward Compatibility & Route Resolution

    func testNotificationItemLegacyJsonDecodingAndRouting() throws {
        let legacyJson = """
        {
            "id": "exam-99",
            "judul": "UAS Sistem Operasi",
            "namaMatkul": "Sistem Operasi",
            "waktu": "12 Nov 2026",
            "tipe": "Ujian",
            "isUrgent": true
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(NotificationItem.self, from: legacyJson)
        XCTAssertEqual(decoded.id, "exam-99")
        XCTAssertEqual(decoded.tipe, .ujian)
        XCTAssertFalse(decoded.isRead)
        XCTAssertEqual(decoded.route, .examDetail(id: 99))
    }

    // MARK: - 4. Deterministic Course Accents & Motion Tokens

    func testDeterministicCourseAccentAndMotionTokens() {
        let accentA1 = AppTheme.Colors.courseAccent(for: "Algoritma & Struktur Data")
        let accentA2 = AppTheme.Colors.courseAccent(for: "  algoritma & struktur data ")
        XCTAssertEqual(accentA1, accentA2, "Course accent must be deterministic and case/whitespace-insensitive")

        let emptyAccent = AppTheme.Colors.courseAccent(for: nil)
        XCTAssertEqual(emptyAccent, AppTheme.Colors.primary)

        // Reduced motion resolution returns safe fallback
        let normalAnim = AppTheme.Motion.resolve(AppTheme.Motion.dockExpand, reduceMotion: false)
        let reducedAnim = AppTheme.Motion.resolve(AppTheme.Motion.dockExpand, reduceMotion: true)
        XCTAssertNotNil(normalAnim)
        XCTAssertNotNil(reducedAnim)
    }
}

