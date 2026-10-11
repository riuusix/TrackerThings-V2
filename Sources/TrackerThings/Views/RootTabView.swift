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

            NavigationStack {
                List {
                    // Bagian Profil Akun
                    Section {
                        HStack(spacing: 14) {
                            ZStack {
                                Circle()
                                    .fill(Color.blue.gradient)
                                    .frame(width: 52, height: 52)

                                Text((authViewModel.currentUser?.username.prefix(1) ?? "U").uppercased())
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(.white)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "Pengguna")
                                    .font(.headline)
                                    .foregroundStyle(.primary)

                                Text(authViewModel.currentUser?.email ?? "@\(authViewModel.currentUser?.username ?? "user")")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    } header: {
                        Text("Akun Terhubung")
                    }

                    // Bagian Koneksi Server
                    Section {
                        Button {
                            isShowingServerSettings = true
                        } label: {
                            HStack {
                                Label("Konfigurasi Server API", systemImage: "server.rack")
                                    .foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.footnote)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    } header: {
                        Text("Pengembang & Jaringan")
                    } footer: {
                        Text("Base URL saat ini: \(AppConfig.shared.serverURLString)")
                            .font(.caption2)
                    }

                    // Bagian Sesi & Keluar
                    Section {
                        Button(role: .destructive) {
                            isShowingLogoutConfirmation = true
                        } label: {
                            HStack {
                                Spacer()
                                Text("Keluar dari Akun")
                                    .fontWeight(.medium)
                                Spacer()
                            }
                        }
                    }
                }
                .navigationTitle("Pengaturan")
                .sheet(isPresented: $isShowingServerSettings) {
                    ServerSettingsSheet()
                }
                .confirmationDialog(
                    "Konfirmasi Keluar",
                    isPresented: $isShowingLogoutConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Keluar", role: .destructive) {
                        Task {
                            await authViewModel.logout()
                        }
                    }
                    Button("Batal", role: .cancel) {}
                } message: {
                    Text("Sesi login Anda akan dihapus dari perangkat ini.")
                }
            }
            .tabItem {
                Label("Pengaturan", systemImage: "gearshape.fill")
            }
        }
        .tint(.blue)
    }
}

