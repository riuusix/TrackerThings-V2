import SwiftUI

public struct RootTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var coordinator = AppNavigationCoordinator.shared
    @State private var dashboardViewModel = DashboardViewModel()
    @State private var courseViewModel = CourseViewModel()
    @State private var examViewModel = ExamViewModel()
    @State private var dockController = QuickActionDockController()
    @State private var inboxStore = ActivityInboxStore.shared
    @Namespace private var morphNamespace
    @State private var isShowingLogoutConfirmation: Bool = false
    @State private var isShowingServerSettings: Bool = false

    public init() {}

    /// Menentukan apakah tab yang sedang aktif berada di root tumpukan navigasi sehingga Gooey Action Dock aman ditampilkan.
    private var shouldShowFloatingDock: Bool {
        switch coordinator.selectedTab {
        case .home:
            return coordinator.homePath.isEmpty
        case .courses:
            return coordinator.coursesPath.isEmpty
        case .exams:
            return coordinator.examsPath.isEmpty
        case .settings:
            return false
        }
    }

    private var hasAnyCourse: Bool {
        !dashboardViewModel.courses.isEmpty || !courseViewModel.courses.isEmpty
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            TabView(selection: $coordinator.selectedTab) {
                NavigationStack(path: $coordinator.homePath) {
                    DashboardView(
                        viewModel: dashboardViewModel,
                        courseViewModel: courseViewModel,
                        examViewModel: examViewModel,
                        dockController: dockController
                    )
                    .navigationDestination(for: AppRoute.self) { route in
                        destinationView(for: route)
                    }
                }
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(AppTab.home)

                NavigationStack(path: $coordinator.coursesPath) {
                    CourseListView(
                        viewModel: courseViewModel,
                        dashboardViewModel: dashboardViewModel,
                        examViewModel: examViewModel
                    )
                    .environment(authViewModel)
                    .navigationDestination(for: AppRoute.self) { route in
                        destinationView(for: route)
                    }
                }
                .tabItem {
                    Label("Mata Kuliah", systemImage: "book.fill")
                }
                .tag(AppTab.courses)

                NavigationStack(path: $coordinator.examsPath) {
                    ExamListView(viewModel: examViewModel)
                    .navigationDestination(for: AppRoute.self) { route in
                        destinationView(for: route)
                    }
                }
                .tabItem {
                    Label("Ujian", systemImage: "graduationcap.fill")
                }
                .tag(AppTab.exams)

                NavigationStack(path: $coordinator.settingsPath) {
                    SettingsView()
                    .navigationDestination(for: AppRoute.self) { route in
                        destinationView(for: route)
                    }
                }
                .tabItem {
                    Label("Pengaturan", systemImage: "gearshape.fill")
                }
                .tag(AppTab.settings)
            }
            .tint(AppTheme.Colors.brandPrimary)

            // Signature Interaction 01 — Gooey Action Dock
            if shouldShowFloatingDock && dockController.activeComposer == nil {
                GooeyActionDock(
                    controller: dockController,
                    morphNamespace: morphNamespace,
                    hasCourses: hasAnyCourse
                )
            }

            // Signature Interaction 02 — Morphing Quick Composer Panel
            if let activeComposer = dockController.activeComposer {
                MorphingQuickComposer(
                    controller: dockController,
                    kind: activeComposer,
                    morphNamespace: morphNamespace,
                    dashboardViewModel: dashboardViewModel,
                    courseViewModel: courseViewModel,
                    examViewModel: examViewModel
                )
            }

            // Signature Interaction 03 — Fly-to-Inbox Arrival Overlay
            FlyToInboxOverlay(store: inboxStore)
        }
        .sheet(isPresented: $inboxStore.isPresentingInboxSheet) {
            ActivityInboxSheet(store: inboxStore)
        }
        .onChange(of: coordinator.selectedTab) { _, _ in
            dockController.resetStateImmediate()
        }
        .onAppear {
            coordinator.markReadyForNavigation()
            if let pending = NotificationService.shared.consumePendingDestination() {
                navigateToDestination(pending)
            }
        }
        .onOpenURL { url in
            coordinator.handleDeepLink(url: url)
        }
        .onReceive(NotificationCenter.default.publisher(for: .openTrackerThingsDestination)) { notification in
            _ = NotificationService.shared.consumePendingDestination()
            if let userInfo = notification.userInfo, let payload = NotificationPayload.parse(from: userInfo) {
                coordinator.handleNotificationPayload(payload)
            } else if let dest = notification.userInfo?["destination"] as? String {
                navigateToDestination(dest)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await refreshActiveTabSafely()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .connectivityRestored)) { _ in
            Task {
                await refreshActiveTabSafely()
            }
        }
    }

    @ViewBuilder
    private func destinationView(for route: AppRoute) -> some View {
        switch route {
        case .taskDetail(let id):
            let initialTask = dashboardViewModel.urgentTasks.first(where: { $0.id == id })
                ?? dashboardViewModel.completedTasks.first(where: { $0.id == id })
            TaskDetailView(
                taskId: id,
                initialTask: initialTask,
                viewModel: dashboardViewModel
            )

        case .courseDetail(let id):
            let initialCourse = courseViewModel.courses.first(where: { $0.id == id })
                ?? dashboardViewModel.courses.first(where: { $0.id == id })
            CourseDetailView(
                courseId: id,
                initialCourse: initialCourse,
                courseViewModel: courseViewModel,
                dashboardViewModel: dashboardViewModel,
                examViewModel: examViewModel
            )

        case .examDetail(let id):
            let initialExam = examViewModel.exams.first(where: { $0.id == id })
                ?? dashboardViewModel.upcomingExam.flatMap { $0.id == id ? $0 : nil }
            ExamDetailView(
                examId: id,
                initialExam: initialExam,
                viewModel: examViewModel
            )

        case .replacementClassDetail(let id):
            let initialItem = dashboardViewModel.replacementClasses.first(where: { $0.id == id })
            ReplacementClassDetailView(
                replacementId: id,
                initialItem: initialItem,
                viewModel: dashboardViewModel
            )

        case .entityNotFound(let entityType, let id, let message):
            EntityNotFoundView(
                entityType: entityType,
                entityId: id,
                message: message
            )
        }
    }

    private func refreshActiveTabSafely() async {
        switch coordinator.selectedTab {
        case .home:
            if !dashboardViewModel.isLoading {
                await dashboardViewModel.loadDashboardData()
            }
        case .courses:
            if !courseViewModel.isLoading {
                await courseViewModel.fetchCourses()
            }
        case .exams:
            if !examViewModel.isLoading {
                await examViewModel.fetchExams()
            }
        case .settings:
            break
        }
    }

    private func navigateToDestination(_ destination: String) {
        switch destination.lowercased() {
        case "home", "dashboard", "jadwal":
            coordinator.selectedTab = .home
        case "tasks", "task":
            coordinator.selectedTab = .home
        case "courses", "course", "matkul":
            coordinator.selectedTab = .courses
        case "exams", "exam", "ujian":
            coordinator.selectedTab = .exams
        case "settings", "pengaturan", "setting":
            coordinator.selectedTab = .settings
        case "admin":
            if authViewModel.currentUser?.role?.lowercased() == "admin" {
                UIApplication.shared.open(AppConfig.shared.adminWebURL)
            } else {
                coordinator.selectedTab = .home
            }
        default:
            coordinator.selectedTab = .home
        }
    }
}
