import SwiftUI

public struct RootTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var dashboardViewModel = DashboardViewModel()
    @State private var courseViewModel = CourseViewModel()
    @State private var examViewModel = ExamViewModel()
    @State private var isShowingLogoutConfirmation: Bool = false
    @State private var isShowingServerSettings: Bool = false

    public init() {}

    public var body: some View {
        TabView {
            DashboardView(viewModel: dashboardViewModel)
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2.fill")
                }

            CourseListView(viewModel: courseViewModel)
                .tabItem {
                    Label("Mata Kuliah", systemImage: "book.fill")
                }

            ExamListView(viewModel: examViewModel)
                .tabItem {
                    Label("Ujian", systemImage: "graduationcap.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Pengaturan", systemImage: "gearshape.fill")
                }

            if authViewModel.currentUser?.role?.lowercased() == "admin" {
                AdminDashboardView()
                    .tabItem {
                        Label("Admin", systemImage: "shield.checkerboard")
                    }
            }
        }
        .tint(.blue)
    }
}

