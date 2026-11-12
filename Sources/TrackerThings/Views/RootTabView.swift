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

    /// Menentukan apakah tab yang sedang aktif berada di root tumpukan navigasi.
    private var isActiveTabAtRoot: Bool {
        switch coordinator.selectedTab {
        case .home:
            return coordinator.homePath.isEmpty
        case .courses:
            return coordinator.coursesPath.isEmpty
        case .tasks:
            return coordinator.tasksPath.isEmpty
        case .exams:
            return coordinator.examsPath.isEmpty
        case .settings:
            return coordinator.settingsPath.isEmpty
        }
    }

    /// Menentukan apakah Gooey Action Dock aman ditampilkan di atas tab aktif.
    private var shouldShowFloatingDock: Bool {
        guard coordinator.selectedTab != .settings else { return false }
        return isActiveTabAtRoot
    }

    private var hasAnyCourse: Bool {
        !dashboardViewModel.courses.isEmpty || !courseViewModel.courses.isEmpty
    }

    public var body: some View {
        ZStack(alignment: .bottom) {
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
                .toolbar(.hidden, for: .tabBar)
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
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.courses)

                NavigationStack(path: $coordinator.tasksPath) {
                    TaskListView(viewModel: dashboardViewModel)
                        .navigationDestination(for: AppRoute.self) { route in
                            destinationView(for: route)
                        }
                }
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.tasks)

                NavigationStack(path: $coordinator.examsPath) {
                    ExamListView(viewModel: examViewModel)
                        .navigationDestination(for: AppRoute.self) { route in
                            destinationView(for: route)
                        }
                }
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.exams)

                NavigationStack(path: $coordinator.settingsPath) {
                    SettingsView()
                        .navigationDestination(for: AppRoute.self) { route in
                            destinationView(for: route)
                        }
                }
                .toolbar(.hidden, for: .tabBar)
                .tag(AppTab.settings)
            }
            .tint(AppTheme.Colors.brandPrimary)

            // Signature Navigation — Frosted Glide Floating Bottom Capsule
            if isActiveTabAtRoot && dockController.activeComposer == nil {
                FrostedGlideTabBar(
                    selectedTab: $coordinator.selectedTab,
                    activeTaskBadgeCount: dashboardViewModel.urgentTasks.count,
                    onReselectActiveTab: { tab in
                        coordinator.popToRoot(for: tab)
                    }
                )
                .padding(.bottom, 6)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(10)
            }

            // Signature Interaction 01 — Gooey Action Dock
            if shouldShowFloatingDock && dockController.activeComposer == nil {
                HStack {
                    Spacer()
                    GooeyActionDock(
                        controller: dockController,
                        inboxStore: inboxStore,
                        morphNamespace: morphNamespace,
                        hasCourses: hasAnyCourse
                    )
                }
                .zIndex(20)
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
                .zIndex(30)
            }

            // Signature Interaction 03 — Fly-to-Inbox Arrival Overlay
            FlyToInboxOverlay(store: inboxStore)
                .zIndex(40)
        }
        .coordinateSpace(name: "RootInteractiveSpace")
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
        case .home, .tasks:
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
        case "tasks", "task", "tugas":
            coordinator.selectedTab = .tasks
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
