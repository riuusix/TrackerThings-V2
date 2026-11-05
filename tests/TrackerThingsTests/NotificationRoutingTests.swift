import XCTest
import SwiftUI
@testable import TrackerThings

final class NotificationRoutingTests: XCTestCase {

    // MARK: - 1. V2 Structured Payload Generation & Parsing

    func testV2PayloadGenerationAndParsing() {
        let original = NotificationPayload(
            schemaVersion: 2,
            entityType: "task",
            entityId: 101,
            kind: "reminder"
        )

        let dict = original.userInfo
        XCTAssertEqual(dict["v"] as? Int, 2)
        XCTAssertEqual(dict["entityType"] as? String, "task")
        XCTAssertEqual(dict["entityId"] as? Int, 101)
        XCTAssertEqual(dict["kind"] as? String, "reminder")
        XCTAssertEqual(dict["destination"] as? String, "tasks")
        XCTAssertEqual(dict["taskId"] as? Int, 101)

        guard let parsed = NotificationPayload.parse(from: dict) else {
            XCTFail("Failed to parse modern v2 userInfo dictionary")
            return
        }

        XCTAssertEqual(parsed.entityType, "task")
        XCTAssertEqual(parsed.entityId, 101)
        XCTAssertEqual(parsed.kind, "reminder")
        XCTAssertEqual(parsed.route, .taskDetail(id: 101))
        XCTAssertEqual(parsed.targetTab, .home)
    }

    // MARK: - 2. V1 Legacy Backward Compatibility Parsing

    func testV1LegacyPayloadsWithVariousTypes() {
        // Task legacy
        let taskUserInfo: [AnyHashable: Any] = ["destination": "tasks", "taskId": 42]
        let parsedTask = NotificationPayload.parse(from: taskUserInfo)
        XCTAssertNotNil(parsedTask)
        XCTAssertEqual(parsedTask?.entityType, "task")
        XCTAssertEqual(parsedTask?.entityId, 42)
        XCTAssertEqual(parsedTask?.route, .taskDetail(id: 42))

        // Course legacy with String ID
        let courseUserInfo: [AnyHashable: Any] = ["destination": "courses", "courseId": "19"]
        let parsedCourse = NotificationPayload.parse(from: courseUserInfo)
        XCTAssertNotNil(parsedCourse)
        XCTAssertEqual(parsedCourse?.entityType, "course")
        XCTAssertEqual(parsedCourse?.entityId, 19)
        XCTAssertEqual(parsedCourse?.route, .courseDetail(id: 19))
        XCTAssertEqual(parsedCourse?.targetTab, .courses)

        // Exam legacy with NSNumber ID
        let examUserInfo: [AnyHashable: Any] = ["destination": "exams", "examId": NSNumber(value: 8)]
        let parsedExam = NotificationPayload.parse(from: examUserInfo)
        XCTAssertNotNil(parsedExam)
        XCTAssertEqual(parsedExam?.entityType, "exam")
        XCTAssertEqual(parsedExam?.entityId, 8)
        XCTAssertEqual(parsedExam?.route, .examDetail(id: 8))
        XCTAssertEqual(parsedExam?.targetTab, .exams)

        // Replacement class legacy
        let repUserInfo: [AnyHashable: Any] = ["destination": "replacement", "replacementId": 7]
        let parsedRep = NotificationPayload.parse(from: repUserInfo)
        XCTAssertNotNil(parsedRep)
        XCTAssertEqual(parsedRep?.entityType, "replacementClass")
        XCTAssertEqual(parsedRep?.entityId, 7)
        XCTAssertEqual(parsedRep?.route, .replacementClassDetail(id: 7))
        XCTAssertEqual(parsedRep?.targetTab, .home)

        // Tab-only legacy notification without entity ID (e.g. general test notification)
        let tabOnlyUserInfo: [AnyHashable: Any] = ["destination": "courses"]
        let parsedTabOnly = NotificationPayload.parse(from: tabOnlyUserInfo)
        XCTAssertNotNil(parsedTabOnly)
        XCTAssertEqual(parsedTabOnly?.targetTab, .courses)
        XCTAssertNil(parsedTabOnly?.route)
    }

    // MARK: - 3. Deep Link URL Parsing

    func testDeepLinkUrlParsing() {
        // Path-based deep links: trackerthings://task/55
        let taskUrl = URL(string: "trackerthings://task/55")!
        let parsedTask = NotificationPayload.parse(from: taskUrl)
        XCTAssertEqual(parsedTask?.entityType, "task")
        XCTAssertEqual(parsedTask?.entityId, 55)
        XCTAssertEqual(parsedTask?.route, .taskDetail(id: 55))

        // Query-based deep links: trackerthings://exam?id=23
        let examUrl = URL(string: "trackerthings://exam?id=23")!
        let parsedExam = NotificationPayload.parse(from: examUrl)
        XCTAssertEqual(parsedExam?.entityType, "exam")
        XCTAssertEqual(parsedExam?.entityId, 23)
        XCTAssertEqual(parsedExam?.route, .examDetail(id: 23))

        // Course deep link: trackerthings://courses/14
        let courseUrl = URL(string: "trackerthings://courses/14")!
        let parsedCourse = NotificationPayload.parse(from: courseUrl)
        XCTAssertEqual(parsedCourse?.entityType, "course")
        XCTAssertEqual(parsedCourse?.entityId, 14)
        XCTAssertEqual(parsedCourse?.route, .courseDetail(id: 14))

        // Replacement class deep link: trackerthings://replacement/31
        let repUrl = URL(string: "trackerthings://replacement/31")!
        let parsedRep = NotificationPayload.parse(from: repUrl)
        XCTAssertEqual(parsedRep?.entityType, "replacementClass")
        XCTAssertEqual(parsedRep?.entityId, 31)
        XCTAssertEqual(parsedRep?.route, .replacementClassDetail(id: 31))

        // Settings tab deep link: trackerthings://settings
        let settingsUrl = URL(string: "trackerthings://settings")!
        let parsedSettings = NotificationPayload.parse(from: settingsUrl)
        XCTAssertEqual(parsedSettings?.targetTab, .settings)
        XCTAssertNil(parsedSettings?.route)

        // Invalid scheme rejection
        let webUrl = URL(string: "https://trackerthings.vercel.app/tasks/1")!
        XCTAssertNil(NotificationPayload.parse(from: webUrl))
    }

    // MARK: - 4. Navigation Coordinator State Machine & Cold Start

    @MainActor
    func testCoordinatorColdStartAndQueuing() {
        let coordinator = AppNavigationCoordinator()
        coordinator.resetAllPaths()
        XCTAssertFalse(coordinator.isReadyForNavigation)
        XCTAssertNil(coordinator.pendingRoute)

        // Saat UI belum siap (cold-start), rute harus diantrekan
        coordinator.navigate(to: .taskDetail(id: 88))
        XCTAssertEqual(coordinator.pendingRoute, .taskDetail(id: 88))
        XCTAssertEqual(coordinator.homePath.count, 0)

        // Saat UI siap, pending route dieksekusi secara otomatis
        coordinator.markReadyForNavigation()
        XCTAssertTrue(coordinator.isReadyForNavigation)
        XCTAssertNil(coordinator.pendingRoute)
        XCTAssertEqual(coordinator.selectedTab, .home)
        XCTAssertEqual(coordinator.homePath.count, 1)

        // Reset membersihkan seluruh tumpukan
        coordinator.resetAllPaths()
        XCTAssertEqual(coordinator.homePath.count, 0)
        XCTAssertEqual(coordinator.selectedTab, .home)
    }

    @MainActor
    func testCoordinatorCourseAndExamRouting() {
        let coordinator = AppNavigationCoordinator()
        coordinator.resetAllPaths()
        coordinator.markReadyForNavigation()

        // Navigasi ke mata kuliah
        coordinator.navigate(to: .courseDetail(id: 12))
        XCTAssertEqual(coordinator.selectedTab, .courses)
        XCTAssertEqual(coordinator.coursesPath.count, 1)

        // Navigasi ke ujian
        coordinator.navigate(to: .examDetail(id: 45))
        XCTAssertEqual(coordinator.selectedTab, .exams)
        XCTAssertEqual(coordinator.examsPath.count, 1)
    }

    @MainActor
    func testCoordinatorNotificationDeduplication() {
        let coordinator = AppNavigationCoordinator()
        coordinator.resetAllPaths()
        coordinator.markReadyForNavigation()

        let payload = NotificationPayload(entityType: "task", entityId: 77)

        // Panggilan pertama berhasil
        coordinator.handleNotificationPayload(payload)
        XCTAssertEqual(coordinator.homePath.count, 1)

        // Panggilan kedua identik dalam waktu < 1 detik diabaikan
        coordinator.handleNotificationPayload(payload)
        XCTAssertEqual(coordinator.homePath.count, 1)
    }
}
