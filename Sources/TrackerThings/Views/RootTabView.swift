import SwiftUI

public struct RootTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var dashboardViewModel = DashboardViewModel()
    @State private var courseViewModel = CourseViewModel()
    @State private var examViewModel = ExamViewModel()
    @State private var isShowingLogoutConfirmation: Bool = false
    @State private var isShowingServerSettings: Bool = false

    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView(
                viewModel: dashboardViewModel,
                courseViewModel: courseViewModel,
                examViewModel: examViewModel
            )
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            CourseListView(
                viewModel: courseViewModel,
                dashboardViewModel: dashboardViewModel,
                examViewModel: examViewModel
            )
                .environment(authViewModel)
                .tabItem {
                    Label("Mata Kuliah", systemImage: "book.fill")
                }
                .tag(1)

            ExamListView(viewModel: examViewModel)
                .tabItem {
                    Label("Ujian", systemImage: "graduationcap.fill")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Pengaturan", systemImage: "gearshape.fill")
                }
                .tag(3)
        }
        .tint(.blue)
        .onAppear {
            if let pending = NotificationService.shared.consumePendingDestination() {
                navigateToDestination(pending)
            }
        }
        .onOpenURL { url in
            handleDeepLink(url: url)
        }
        .onReceive(NotificationCenter.default.publisher(for: .openTrackerThingsDestination)) { notification in
            _ = NotificationService.shared.consumePendingDestination()
            if let dest = notification.userInfo?["destination"] as? String {
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

    private func refreshActiveTabSafely() async {
        switch selectedTab {
        case 0:
            if !dashboardViewModel.isLoading {
                await dashboardViewModel.loadDashboardData()
            }
        case 1:
            if !courseViewModel.isLoading {
                await courseViewModel.fetchCourses()
            }
        case 2:
            if !examViewModel.isLoading {
                await examViewModel.fetchExams()
            }
        default:
            break
        }
    }

    private func handleDeepLink(url: URL) {
        guard url.scheme?.lowercased() == "trackerthings" else { return }
        let host = url.host?.lowercased() ?? ""
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
        let target = host.isEmpty ? path : host
        navigateToDestination(target)
    }

    private func navigateToDestination(_ destination: String) {
        switch destination.lowercased() {
        case "home", "dashboard", "jadwal", "tasks", "task":
            selectedTab = 0
        case "courses", "course", "matkul":
            selectedTab = 1
        case "exams", "exam", "ujian":
            selectedTab = 2
        case "settings", "pengaturan", "setting":
            selectedTab = 3
        case "admin":
            if authViewModel.currentUser?.role?.lowercased() == "admin" {
                UIApplication.shared.open(AppConfig.shared.adminWebURL)
            } else {
                selectedTab = 0
            }
        default:
            selectedTab = 0
        }
    }
}
