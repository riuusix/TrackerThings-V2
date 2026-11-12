import XCTest
import SwiftUI
@testable import TrackerThings

/// Mock layanan data untuk memverifikasi persistensi sematan (`isPinned`), pengingat kustom (`reminderAt`),
/// serta ketahanan terhadap kegagalan jaringan (rollback).
private final class MockInteractionDataService: TrackerDataServiceProtocol, @unchecked Sendable {
    var tasks: [TugasItem] = []
    var courses: [JadwalItem] = []
    var exams: [UjianItem] = []
    var replacements: [KelasPenggantiItem] = []
    var shouldFailPinUpdate: Bool = false
    var shouldFailReminderUpdate: Bool = false

    func getJadwalList() async throws -> [JadwalItem] { courses }
    func createJadwal(_ item: JadwalItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func updateJadwal(_ item: JadwalItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func deleteJadwal(id: Int) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }

    func getTugasList() async throws -> [TugasItem] { tasks }
    func createTugas(_ item: TugasItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func updateTugas(_ item: TugasItem) async throws -> BaseResponse {
        if let idx = tasks.firstIndex(where: { $0.id == item.id }) {
            tasks[idx] = item
        }
        return BaseResponse(success: true, message: "OK")
    }
    func updateTugasProgress(id: Int, progress: Int) async throws -> BaseResponse {
        if let idx = tasks.firstIndex(where: { $0.id == id }) {
            tasks[idx].progress = progress
            tasks[idx].status = progress >= 100 ? .selesai : (progress > 0 ? .sedangDikerjakan : .belumDikerjakan)
        }
        return BaseResponse(success: true, message: "OK")
    }
    func updateTugasPin(id: Int, isPinned: Bool) async throws -> BaseResponse {
        if shouldFailPinUpdate {
            throw NSError(domain: "MockError", code: 500, userInfo: [NSLocalizedDescriptionKey: "Simulasi gagal simpan sematan"])
        }
        if let idx = tasks.firstIndex(where: { $0.id == id }) {
            tasks[idx].isPinned = isPinned
        }
        return BaseResponse(success: true, message: "OK")
    }
    func updateTugasReminder(id: Int, reminderAt: Date?) async throws -> BaseResponse {
        if shouldFailReminderUpdate {
            throw NSError(domain: "MockError", code: 500, userInfo: [NSLocalizedDescriptionKey: "Simulasi gagal simpan pengingat"])
        }
        if let idx = tasks.firstIndex(where: { $0.id == id }) {
            tasks[idx].reminderAt = reminderAt
        }
        return BaseResponse(success: true, message: "OK")
    }
    func deleteTugas(id: Int) async throws -> BaseResponse {
        tasks.removeAll { $0.id == id }
        return BaseResponse(success: true, message: "OK")
    }

    func getUjianList() async throws -> [UjianItem] { exams }
    func createUjian(_ item: UjianItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func updateUjian(_ item: UjianItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func deleteUjian(id: Int) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }

    func getKelasPenggantiList() async throws -> [KelasPenggantiItem] { replacements }
    func createKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func updateKelasPengganti(_ item: KelasPenggantiItem) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func selesaiKelasPengganti(id: Int) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }
    func deleteKelasPengganti(id: Int) async throws -> BaseResponse { BaseResponse(success: true, message: "OK") }

    func previewScheduleImport(
        fileData: Data,
        fileName: String,
        mimeType: String,
        rawText: String?,
        ocrWordsJson: String?
    ) async throws -> ScheduleImportPreviewResponse {
        ScheduleImportPreviewResponse()
    }

    func visionScheduleImport(fileData: Data, fileName: String, mimeType: String, localItemsJson: String?) async throws -> ScheduleImportPreviewResponse {
        ScheduleImportPreviewResponse()
    }

    func confirmScheduleImport(items: [ImportScheduleItem], learnCorrections: Bool) async throws -> ScheduleImportConfirmResponse {
        ScheduleImportConfirmResponse(count: 0, items: nil, learnedMappingsTotal: nil)
    }

    func syncPendingScheduleDrafts() async throws -> [ScheduleImportConfirmResponse] {
        []
    }

    func getAcademicInsights(referenceDate: String, timezone: String, upcomingWindowDays: Int) async throws -> AcademicIntelligenceSummary {
        throw NSError(domain: "MockError", code: 404)
    }
}

final class InteractionQualityTests: XCTestCase {

    // MARK: - 1. Action Entry Points & Gooey Dock Action Routing

    @MainActor
    func testCanonicalDockActionRoutingSeparatesCreateFromInbox() {
        let suiteName = "com.trackerthings.tests.dock.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let inboxStore = ActivityInboxStore(defaults: defaults, keyPrefix: "dock_test")
        let controller = QuickActionDockController()

        // Verifikasi 5 aksi kanonik pada Gooey Dock (4 Buat Cepat + 1 Kotak Aktivitas)
        let allActions = DockAction.allDockActions
        XCTAssertEqual(allActions.count, 5)
        XCTAssertEqual(allActions.last, .openInbox)

        // Buka dock terlebih dahulu
        controller.toggleDock(reduceMotion: true)
        XCTAssertTrue(controller.isExpanded)

        // Pilih .openInbox -> menutup dock dan membuka sheet Inbox tanpa mengaktifkan composer pembuatan
        controller.performAction(.openInbox, inboxStore: inboxStore, reduceMotion: true)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertNil(controller.activeComposer)
        XCTAssertTrue(inboxStore.isPresentingInboxSheet)

        inboxStore.isPresentingInboxSheet = false

        // Pilih .create(.task) -> menutup dock dan membuka MorphingQuickComposer(.task)
        controller.toggleDock(reduceMotion: true)
        controller.performAction(.create(.task), inboxStore: inboxStore, reduceMotion: true)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.activeComposer, .task)
        XCTAssertFalse(inboxStore.isPresentingInboxSheet)
    }

    // MARK: - 2. Inbox Idempotency & Canonical Event Identity

    @MainActor
    func testInboxCanonicalEventIdentityAndIdempotentSync() {
        let suiteName = "com.trackerthings.tests.idempotency.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ActivityInboxStore(defaults: defaults, keyPrefix: "idem_test")
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!

        let task = TugasItem(
            id: 42,
            idJadwal: 5,
            namaTugas: "Implementasi Dijkstra",
            deadline: tomorrow,
            prioritas: .tinggi,
            jenis: .individu,
            status: .sedangDikerjakan,
            progress: 40
        )

        // Sinkronisasi berulang dengan state akademik yang sama tidak boleh menduplikasi baris
        store.syncWithAcademicState(tasks: [task], exams: [], replacementClasses: [])
        store.syncWithAcademicState(tasks: [task], exams: [], replacementClasses: [])
        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.items.first?.id, "task-42")
        XCTAssertEqual(store.unreadCount, 1)

        // Tandai sudah dibaca -> sinkronisasi berikutnya wajib mempertahankan status baca
        store.markAsRead(id: "task-42")
        XCTAssertEqual(store.unreadCount, 0)
        store.syncWithAcademicState(tasks: [task], exams: [], replacementClasses: [])
        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.unreadCount, 0)

        // Kedatangan notifikasi foreground dengan timestamp acak ("fg-task-42-176...")
        // dinormalkan ke ID kanonik "reminder-task-42" dan dijamin idempoten
        let fgArrival1 = NotificationItem(
            id: "fg-task-42-1760000111",
            judul: "Pengingat Tugas: Implementasi Dijkstra",
            namaMatkul: "Algoritma",
            waktu: "Baru saja",
            tipe: .tugas,
            isUrgent: true,
            entityType: "task",
            entityId: 42,
            eventKind: "reminder"
        )
        let fgArrival2 = NotificationItem(
            id: "fg-task-42-1760000999",
            judul: "Pengingat Tugas: Implementasi Dijkstra",
            namaMatkul: "Algoritma",
            waktu: "Baru saja",
            tipe: .tugas,
            isUrgent: true,
            entityType: "task",
            entityId: 42,
            eventKind: "reminder"
        )

        XCTAssertEqual(fgArrival1.id, "reminder-task-42")
        XCTAssertEqual(fgArrival2.id, "reminder-task-42")
        XCTAssertEqual(fgArrival1.route, .taskDetail(id: 42))

        store.enqueueArrival(fgArrival1, triggerFlight: true, reduceMotion: true)
        let countAfterFirst = store.items.count
        store.enqueueArrival(fgArrival2, triggerFlight: true, reduceMotion: true)
        XCTAssertEqual(store.items.count, countAfterFirst, "Repeated foreground delivery of the same reminder must not create duplicate rows")
    }

    // MARK: - 3. Swipe Gesture State Machine & Threshold Physics

    @MainActor
    func testTaskSwipeStateMachineAndDirectionLocking() {
        let coordinator = TaskSwipeCoordinator()

        // 1. Proteksi back-swipe tepi kiri
        XCTAssertTrue(TaskSwipeCoordinator.isLeftEdgeBackGesture(startX: 12))
        XCTAssertFalse(TaskSwipeCoordinator.isLeftEdgeBackGesture(startX: 36))

        // 2. Direction locking membedakan scroll vertikal dari swipe horizontal
        XCTAssertFalse(TaskSwipeCoordinator.shouldLockHorizontal(deltaX: 8, deltaY: 2)) // di bawah jarak minimum 12pt
        XCTAssertFalse(TaskSwipeCoordinator.shouldLockHorizontal(deltaX: 18, deltaY: 22)) // dominan vertikal
        XCTAssertTrue(TaskSwipeCoordinator.shouldLockHorizontal(deltaX: 28, deltaY: 6)) // dominan horizontal

        // 3. State selama pergeseran
        XCTAssertEqual(TaskSwipeCoordinator.stateDuringDrag(for: 0), .closed)
        XCTAssertEqual(TaskSwipeCoordinator.stateDuringDrag(for: 45), .revealingPin)
        XCTAssertEqual(TaskSwipeCoordinator.stateDuringDrag(for: -45), .revealingReminder)

        // 4. Evaluasi pelepasan jari (partial drag vs reveal snap vs full commit)
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: 24, predictedEndOffset: 30, isOffline: false),
            .snapClosed
        )
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: 68, predictedEndOffset: 80, isOffline: false),
            .snapPinVisible
        )
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: 156, predictedEndOffset: 180, isOffline: false),
            .commitPinImmediate
        )
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: -68, predictedEndOffset: -80, isOffline: false),
            .snapReminderVisible
        )
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: -156, predictedEndOffset: -180, isOffline: false),
            .openReminderImmediate
        )

        // 5. Saat offline, swipe selalu kembali tertutup dengan aman
        XCTAssertEqual(
            TaskSwipeCoordinator.evaluateRelease(offset: 160, predictedEndOffset: 200, isOffline: true),
            .snapClosed
        )

        // 6. Koordinasi baris tunggal yang terbuka
        coordinator.registerOpenRow(taskId: 101)
        XCTAssertEqual(coordinator.activeOpenTaskId, 101)
        coordinator.registerOpenRow(taskId: 202)
        XCTAssertEqual(coordinator.activeOpenTaskId, 202)
        coordinator.closeAll()
        XCTAssertNil(coordinator.activeOpenTaskId)
    }

    // MARK: - 4. Pin Persistence, Ordering & Single-Representation Contract

    @MainActor
    func testPinPersistenceOrderingAndNoDuplicateActiveRepresentation() async {
        let now = Date()
        let day1 = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        let day2 = Calendar.current.date(byAdding: .day, value: 2, to: now)!

        let mockService = MockInteractionDataService()
        mockService.tasks = [
            TugasItem(id: 1, idJadwal: 10, namaTugas: "Tugas A", deadline: day2, prioritas: .rendah, jenis: .individu, status: .belumDikerjakan, progress: 0, isPinned: false),
            TugasItem(id: 2, idJadwal: 10, namaTugas: "Tugas B", deadline: day1, prioritas: .sedang, jenis: .individu, status: .belumDikerjakan, progress: 20, isPinned: false),
            TugasItem(id: 3, idJadwal: 10, namaTugas: "Tugas C", deadline: day1, prioritas: .tinggi, jenis: .kelompok, status: .sedangDikerjakan, progress: 50, isPinned: true)
        ]

        let vm = DashboardViewModel(dataService: mockService)
        await vm.loadDashboardData()

        // Awal: Tugas 3 disematkan; Tugas 1 & 2 berada di daftar belum disematkan
        XCTAssertEqual(vm.pinnedTasks.map { $0.id }, [3])
        XCTAssertEqual(vm.unpinnedUrgentTasks.map { $0.id }, [2, 1])

        // Verifikasi kontrak Single-Representation: irisan antara `pinnedTasks` dan `unpinnedUrgentTasks` selalu kosong
        let initialOverlap = Set(vm.pinnedTasks.map { $0.id }).intersection(Set(vm.unpinnedUrgentTasks.map { $0.id }))
        XCTAssertTrue(initialOverlap.isEmpty, "A pinned task must never appear in both pinnedTasks and unpinnedUrgentTasks")

        // Sematkan Tugas 1 -> berpindah ke `pinnedTasks` dan hilang dari `unpinnedUrgentTasks`
        let task1 = vm.urgentTasks.first(where: { $0.id == 1 })!
        let pinSuccess = await vm.toggleTaskPin(task: task1)
        XCTAssertTrue(pinSuccess)
        XCTAssertEqual(vm.pinnedTasks.map { $0.id }, [3, 1]) // diurutkan berdasarkan tenggat (day1 lalu day2)
        XCTAssertEqual(vm.unpinnedUrgentTasks.map { $0.id }, [2])

        let overlapAfterPin = Set(vm.pinnedTasks.map { $0.id }).intersection(Set(vm.unpinnedUrgentTasks.map { $0.id }))
        XCTAssertTrue(overlapAfterPin.isEmpty)

        // Simulasi kegagalan jaringan saat melepas sematan -> rollback kembali ke state semula
        mockService.shouldFailPinUpdate = true
        let pinnedTask1 = vm.pinnedTasks.first(where: { $0.id == 1 })!
        let failedUnpin = await vm.toggleTaskPin(task: pinnedTask1)
        XCTAssertFalse(failedUnpin)
        XCTAssertTrue(vm.pinnedTasks.contains(where: { $0.id == 1 }), "Failed pin toggle must roll back cleanly")
    }

    // MARK: - 5. Custom Reminder Validation, Persistence & Notification Coexistence

    @MainActor
    func testCustomReminderValidationPersistenceAndIdentifierSeparation() async {
        let now = Date()
        let deadline = Calendar.current.date(byAdding: .day, value: 3, to: now)!
        let validReminder = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        let pastReminder = Calendar.current.date(byAdding: .hour, value: -2, to: now)!
        let afterDeadlineReminder = Calendar.current.date(byAdding: .day, value: 5, to: now)!

        // 1. Identifier standar dan kustom harus berbeda agar tidak saling menimpa
        XCTAssertEqual(NotificationService.standardTaskReminderIdentifier(for: 77), "task-77")
        XCTAssertEqual(NotificationService.customTaskReminderIdentifier(for: 77), "task-custom-reminder-77")
        XCTAssertNotEqual(
            NotificationService.standardTaskReminderIdentifier(for: 77),
            NotificationService.customTaskReminderIdentifier(for: 77)
        )

        // 2. Validasi rentang waktu pengingat kustom
        XCTAssertTrue(NotificationService.isValidCustomReminder(reminderAt: validReminder, deadline: deadline, now: now))
        XCTAssertFalse(NotificationService.isValidCustomReminder(reminderAt: pastReminder, deadline: deadline, now: now))
        XCTAssertFalse(NotificationService.isValidCustomReminder(reminderAt: afterDeadlineReminder, deadline: deadline, now: now))

        // 3. Persistensi melalui ViewModel & DataService
        let mockService = MockInteractionDataService()
        let task = TugasItem(
            id: 77,
            idJadwal: 10,
            namaTugas: "Makalah Keamanan Jaringan",
            deadline: deadline,
            prioritas: .tinggi,
            jenis: .individu,
            status: .sedangDikerjakan,
            progress: 30
        )
        mockService.tasks = [task]

        let vm = DashboardViewModel(dataService: mockService)
        await vm.loadDashboardData()

        // Menolak waktu di masa lalu
        let invalidResult = await vm.updateTaskCustomReminder(task: task, reminderAt: pastReminder)
        XCTAssertFalse(invalidResult)
        XCTAssertNil(vm.urgentTasks.first?.reminderAt)

        // Menyimpan waktu pengingat kustom yang valid
        let validResult = await vm.updateTaskCustomReminder(task: task, reminderAt: validReminder)
        XCTAssertTrue(validResult)
        XCTAssertEqual(vm.urgentTasks.first?.reminderAt, validReminder)
        XCTAssertEqual(mockService.tasks.first?.reminderAt, validReminder)

        // Menghapus pengingat kustom
        let updatedTask = vm.urgentTasks.first!
        let clearResult = await vm.updateTaskCustomReminder(task: updatedTask, reminderAt: nil)
        XCTAssertTrue(clearResult)
        XCTAssertNil(vm.urgentTasks.first?.reminderAt)
        XCTAssertNil(mockService.tasks.first?.reminderAt)
    }

    // MARK: - 6. True Fly-to-Inbox Anchored Trajectory & Interruption Safety

    @MainActor
    func testAnchoredFlightTrajectoryAndInterruptionPreservesInboxData() {
        let suiteName = "com.trackerthings.tests.flight.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let store = ActivityInboxStore(defaults: defaults, keyPrefix: "flight_test")
        store.inboxTargetRect = CGRect(x: 310, y: 720, width: 56, height: 56)

        // Verifikasi matematika kurva Bézier kuadratik dari asal (0,0) ke target (deltaX, deltaY)
        let startPoint = AnchoredFlightModifier.pointOnQuadraticBezier(t: 0, deltaX: 140, deltaY: 640)
        let midPoint = AnchoredFlightModifier.pointOnQuadraticBezier(t: 0.5, deltaX: 140, deltaY: 640)
        let endPoint = AnchoredFlightModifier.pointOnQuadraticBezier(t: 1.0, deltaX: 140, deltaY: 640)

        XCTAssertEqual(startPoint.x, 0, accuracy: 0.001)
        XCTAssertEqual(startPoint.y, 0, accuracy: 0.001)
        XCTAssertGreaterThan(midPoint.x, 0)
        XCTAssertEqual(endPoint.x, 140, accuracy: 0.001)
        XCTAssertEqual(endPoint.y, 640, accuracy: 0.001)

        // Enqueue item dengan animasi terbang aktif, lalu interupsi seketika (simulasi tab switch / tutup)
        let item = NotificationItem(
            judul: "Kuis Mendadak Aljabar Linear",
            namaMatkul: "Aljabar Linear",
            waktu: "Besok • 08:00",
            tipe: .ujian,
            isUrgent: true,
            entityType: "exam",
            entityId: 88,
            eventKind: "created"
        )
        store.enqueueArrival(item, triggerFlight: true, reduceMotion: false)
        XCTAssertNotNil(store.activeFlightItem)
        XCTAssertEqual(store.items.count, 1)

        // Interupsi di tengah penerbangan
        store.dismissActiveFlight(reduceMotion: true)
        XCTAssertNil(store.activeFlightItem)
        XCTAssertEqual(store.flightPhase, .idle)

        // Data wajib tetap tersimpan utuh di Inbox dan di UserDefaults meskipun animasi diinterupsi
        XCTAssertEqual(store.items.count, 1)
        XCTAssertEqual(store.items.first?.id, "exam-88")

        let reloaded = ActivityInboxStore(defaults: defaults, keyPrefix: "flight_test")
        XCTAssertEqual(reloaded.items.count, 1)
        XCTAssertEqual(reloaded.items.first?.id, "exam-88")
    }

    // MARK: - 7. Invisible Pagination Math & Direction-Locked Deck Swipe (Max 3 Per Page)

    func testInvisibleDeckPagerMathMaxThreeItemsAndDirectionLockedSwipe() {
        let emptyPages = InvisibleDeckPagerMath.chunkPages([Int](), pageSize: 3)
        XCTAssertTrue(emptyPages.isEmpty)
        XCTAssertEqual(InvisibleDeckPagerMath.totalPages(itemCount: 0, pageSize: 3), 1)
        XCTAssertEqual(InvisibleDeckPagerMath.rangeSummaryText(pageIndex: 0, itemCount: 0, pageSize: 3), "0 tugas")

        let eightItems = Array(1...8)
        let pages = InvisibleDeckPagerMath.chunkPages(eightItems, pageSize: 3)
        XCTAssertEqual(pages.count, 3)
        XCTAssertEqual(pages[0], [1, 2, 3])
        XCTAssertEqual(pages[1], [4, 5, 6])
        XCTAssertEqual(pages[2], [7, 8])
        for page in pages {
            XCTAssertLessThanOrEqual(page.count, 3, "Every page in InvisibleTaskPager must contain at most 3 tasks")
        }

        XCTAssertEqual(InvisibleDeckPagerMath.rangeSummaryText(pageIndex: 0, itemCount: 8, pageSize: 3), "1–3 dari 8")
        XCTAssertEqual(InvisibleDeckPagerMath.rangeSummaryText(pageIndex: 1, itemCount: 8, pageSize: 3), "4–6 dari 8")
        XCTAssertEqual(InvisibleDeckPagerMath.rangeSummaryText(pageIndex: 2, itemCount: 8, pageSize: 3), "7–8 dari 8")
        XCTAssertEqual(InvisibleDeckPagerMath.clampPageIndex(99, itemCount: 8, pageSize: 3), 2)
        XCTAssertEqual(InvisibleDeckPagerMath.clampPageIndex(-3, itemCount: 8, pageSize: 3), 0)

        // Gestur dominan vertikal tidak boleh memicu perpindahan halaman horizontal
        XCTAssertEqual(
            InvisibleDeckPagerMath.evaluateDeckSwipeDirection(
                translationWidth: -50,
                translationHeight: 65,
                predictedEndWidth: -70,
                currentPage: 0,
                totalPages: 3
            ),
            0
        )

        // Geser kiri dominan horizontal berpindah ke halaman berikutnya (+1)
        XCTAssertEqual(
            InvisibleDeckPagerMath.evaluateDeckSwipeDirection(
                translationWidth: -64,
                translationHeight: 8,
                predictedEndWidth: -90,
                currentPage: 0,
                totalPages: 3
            ),
            1
        )

        // Geser kanan dominan horizontal kembali ke halaman sebelumnya (-1)
        XCTAssertEqual(
            InvisibleDeckPagerMath.evaluateDeckSwipeDirection(
                translationWidth: 64,
                translationHeight: 8,
                predictedEndWidth: 90,
                currentPage: 2,
                totalPages: 3
            ),
            -1
        )
    }

    // MARK: - 8. Gooey Action Dock Choreography & Zero Residual Closed Surface

    @MainActor
    func testGooeyActionDockMultiStageChoreographyAndZeroResidualClosedSurface() {
        let controller = QuickActionDockController()

        // State awal tertutup: tidak ada panel transparan sisa & bridgeProgress == 0
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.phase, .closed)
        XCTAssertFalse(controller.isPanelSurfaceRendered)
        XCTAssertFalse(controller.areMenuItemsRevealed)
        XCTAssertEqual(controller.bridgeProgress, 0.0, accuracy: 0.001)
        XCTAssertEqual(controller.triggerCompressionScale, 1.0, accuracy: 0.001)

        // Saat reduceMotion == false, openDock memulai fase .pressing (scale 0.95)
        controller.openDock(reduceMotion: false)
        XCTAssertTrue(controller.isExpanded)
        XCTAssertEqual(controller.phase, .pressing)
        XCTAssertEqual(controller.triggerCompressionScale, 0.95, accuracy: 0.001)

        // Saat closeDock dipanggil dengan reduceMotion == false, item menghilang lebih dulu (.collapsingItems)
        controller.closeDock(reduceMotion: false)
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.phase, .collapsingItems)
        XCTAssertFalse(controller.areMenuItemsRevealed, "Menu items and text must disappear first before panel shrinks")
        XCTAssertTrue(controller.isPanelSurfaceRendered, "Panel surface stays visible briefly during collapsingItems before shrinking into bubble")

        // Reset langsung mengembalikan ke .closed bersih tanpa residu
        controller.resetStateImmediate()
        XCTAssertFalse(controller.isExpanded)
        XCTAssertEqual(controller.phase, .closed)
        XCTAssertFalse(controller.isPanelSurfaceRendered)
        XCTAssertEqual(controller.bridgeProgress, 0.0, accuracy: 0.001)
    }

    // MARK: - 9. Frosted Glide 5-Tab Navigation & TaskListView State Preservation

    @MainActor
    func testFrostedGlideFiveTabNavigationAndTasksPathPreservation() {
        let allTabs = AppTab.allCases
        XCTAssertEqual(allTabs.count, 5)
        XCTAssertEqual(allTabs.map { $0.shortLabel }, ["Beranda", "Jadwal", "Tugas", "Ujian", "Profil"])

        let coordinator = AppNavigationCoordinator()
        coordinator.resetAllPaths()
        coordinator.markReadyForNavigation()

        // Beralih ke tab Tugas (.tasks) lalu buka detail tugas -> harus masuk ke tasksPath dan tetap di tab .tasks
        coordinator.selectedTab = .tasks
        coordinator.navigate(to: .taskDetail(id: 501))
        XCTAssertEqual(coordinator.selectedTab, .tasks)
        XCTAssertEqual(coordinator.tasksPath.count, 1)
        XCTAssertEqual(coordinator.homePath.count, 0)

        // Ketuk ulang tab aktif (popToRoot) mengosongkan tasksPath tanpa merusak tab lain
        coordinator.popToRoot(for: .tasks)
        XCTAssertEqual(coordinator.tasksPath.count, 0)
        XCTAssertEqual(coordinator.selectedTab, .tasks)

        // Verifikasi pelestarian state halaman & filter pada DashboardViewModel
        let vm = DashboardViewModel(dataService: MockInteractionDataService())
        vm.taskListSelectedSegment = 1
        vm.taskListHistoryPage = 2
        vm.taskListSelectedPriority = "Tinggi"
        vm.taskListSearchText = "Algoritma"
        XCTAssertEqual(vm.taskListSelectedSegment, 1)
        XCTAssertEqual(vm.taskListHistoryPage, 2)
        XCTAssertEqual(vm.taskListSelectedPriority, "Tinggi")
        XCTAssertEqual(vm.taskListSearchText, "Algoritma")
    }

    // MARK: - 10. LocalCacheService User-Scoped Isolation & TTL Freshness

    func testLocalCacheServiceUserScopedIsolationAndTTLFreshness() {
        let cache = LocalCacheService.shared
        defer { cache.clearAllCache() }

        // Simpan data pada scope User 101
        cache.setUserScope(userId: 101)
        cache.save(["Tugas User 101"], forKey: "unit_test_tasks")
        XCTAssertTrue(cache.isFresh(forKey: "unit_test_tasks", ttlSeconds: 60))
        XCTAssertEqual(cache.load([String].self, forKey: "unit_test_tasks"), ["Tugas User 101"])

        // Beralih ke User 202 -> tidak boleh membaca cache milik User 101
        cache.setUserScope(userId: 202)
        XCTAssertNil(cache.load([String].self, forKey: "unit_test_tasks"))
        XCTAssertFalse(cache.isFresh(forKey: "unit_test_tasks", ttlSeconds: 60))

        // Invalidate freshness bekerja deterministik
        cache.save(["Tugas User 202"], forKey: "unit_test_tasks")
        XCTAssertTrue(cache.isFresh(forKey: "unit_test_tasks", ttlSeconds: 60))
        cache.invalidateFreshness(forKey: "unit_test_tasks")
        XCTAssertFalse(cache.isFresh(forKey: "unit_test_tasks", ttlSeconds: 60))
    }
}

