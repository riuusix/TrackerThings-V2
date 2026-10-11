import SwiftUI

public struct RootTabView: View {
    @State private var authViewModel = AuthViewModel()
    @State private var dashboardViewModel = DashboardViewModel()
    @State private var courseViewModel = CourseViewModel()
    @State private var examViewModel = ExamViewModel()

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

            NavigationStack {
                Text("Profil & Pengaturan")
                    .navigationTitle("Pengaturan")
            }
            .tabItem {
                Label("Pengaturan", systemImage: "gearshape.fill")
            }
        }
        .tint(.blue)
    }
}

