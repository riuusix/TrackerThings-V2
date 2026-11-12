import Foundation
import SwiftUI
import os

private let navLogger = Logger(subsystem: "com.trackerthings.app", category: "Navigation")

/// Koordinator Navigasi Terpusat untuk TrackerThings V2 (iOS Native).
/// Mengelola status tab aktif, tumpukan navigasi independen per-tab (NavigationPath),
/// perutean deep link, mitigasi race condition pada peluncuran awal (cold-start),
/// serta deduplikasi respons notifikasi.
@Observable
@MainActor
public final class AppNavigationCoordinator {
    public static let shared = AppNavigationCoordinator()

    public var selectedTab: AppTab = .home

    // MARK: - Independent Tab Navigation Paths
    public var homePath = NavigationPath()
    public var coursesPath = NavigationPath()
    public var tasksPath = NavigationPath()
    public var examsPath = NavigationPath()
    public var settingsPath = NavigationPath()

    // MARK: - Cold-Start / Lifecycle State
    public private(set) var pendingRoute: AppRoute? = nil
    public var isReadyForNavigation: Bool = false

    // MARK: - Deduplikasi Intent
    private var lastHandledKey: String? = nil
    private var lastHandledTimestamp: Date = .distantPast

    public init() {}

    /// Mendaftarkan kesiapan antarmuka utama untuk menerima transisi navigasi.
    /// Memproses pending route jika ada intent yang tertunda dari cold-start.
    public func markReadyForNavigation() {
        self.isReadyForNavigation = true
        if let pending = pendingRoute {
            navLogger.info("Processing pending route after UI became ready: \(pending.title, privacy: .public)")
            self.pendingRoute = nil
            navigate(to: pending)
        }
    }

    /// Mereset seluruh tumpukan navigasi ke root tampilan masing-masing tab.
    public func resetAllPaths() {
        homePath = NavigationPath()
        coursesPath = NavigationPath()
        tasksPath = NavigationPath()
        examsPath = NavigationPath()
        settingsPath = NavigationPath()
        pendingRoute = nil
        selectedTab = .home
    }

    /// Mengembalikan tumpukan navigasi tab tertentu ke tampilan root.
    public func popToRoot(for tab: AppTab) {
        switch tab {
        case .home:
            if !homePath.isEmpty { homePath = NavigationPath() }
        case .courses:
            if !coursesPath.isEmpty { coursesPath = NavigationPath() }
        case .tasks:
            if !tasksPath.isEmpty { tasksPath = NavigationPath() }
        case .exams:
            if !examsPath.isEmpty { examsPath = NavigationPath() }
        case .settings:
            if !settingsPath.isEmpty { settingsPath = NavigationPath() }
        }
    }

    /// Melakukan navigasi terarah ke rute tujuan spesifik.
    public func navigate(to route: AppRoute) {
        guard isReadyForNavigation else {
            navLogger.info("UI not ready yet. Queuing route for cold-start delivery: \(route.title, privacy: .public)")
            self.pendingRoute = route
            return
        }

        withAnimation(.snappy(duration: 0.28)) {
            switch route {
            case .taskDetail:
                if selectedTab == .tasks {
                    tasksPath.append(route)
                } else {
                    selectedTab = .home
                    homePath.append(route)
                }

            case .replacementClassDetail:
                selectedTab = .home
                homePath.append(route)

            case .courseDetail:
                selectedTab = .courses
                coursesPath.append(route)

            case .examDetail:
                selectedTab = .exams
                examsPath.append(route)

            case .entityNotFound:
                // Push ke tab yang sedang aktif saat ini
                switch selectedTab {
                case .home: homePath.append(route)
                case .courses: coursesPath.append(route)
                case .tasks: tasksPath.append(route)
                case .exams: examsPath.append(route)
                case .settings: settingsPath.append(route)
                }
            }
        }
    }

    /// Menangani payload notifikasi lokal yang diklik pengguna.
    public func handleNotificationPayload(_ payload: NotificationPayload) {
        let dedupeKey = "\(payload.entityType)-\(payload.entityId)"
        let now = Date()

        // Cegah eksekusi ganda jika notifikasi yang sama terpicu beruntun dalam 1 detik
        if lastHandledKey == dedupeKey && now.timeIntervalSince(lastHandledTimestamp) < 1.0 {
            navLogger.info("Ignoring duplicate notification response: \(dedupeKey, privacy: .public)")
            return
        }
        lastHandledKey = dedupeKey
        lastHandledTimestamp = now

        navLogger.info("Handling notification payload: type=\(payload.entityType, privacy: .public), id=\(payload.entityId)")

        if let route = payload.route {
            navigate(to: route)
        } else {
            withAnimation(.snappy(duration: 0.25)) {
                selectedTab = payload.targetTab
            }
        }
    }

    /// Menangani URL deep link scheme `trackerthings://...`
    public func handleDeepLink(url: URL) {
        navLogger.info("Handling deep link URL: \(url.absoluteString, privacy: .public)")
        guard let payload = NotificationPayload.parse(from: url) else {
            navLogger.warning("Could not parse deep link URL: \(url.absoluteString, privacy: .public)")
            return
        }
        handleNotificationPayload(payload)
    }
}
