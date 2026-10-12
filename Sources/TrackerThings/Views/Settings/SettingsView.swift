import SwiftUI

/// Tampilan native SwiftUI untuk pengaturan aplikasi TrackerThings V2.
/// Mengorganisasikan akun, keamanan, notifikasi, layanan backend, dan logout secara terstruktur sesuai Apple HIG.
public struct SettingsView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel = SettingsViewModel()
    #if DEBUG
    @State private var isShowingServerSettings: Bool = false
    #endif
    @State private var isShowingLogoutConfirmation: Bool = false
    @State private var notificationStatusText: String = "Memeriksa..."
    @State private var isNotificationAuthorized: Bool = false
    @State private var testNotificationMessage: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                // MARK: - Akun & Profil (Tappable Summary & Security Rows)
                Section {
                    NavigationLink {
                        EditProfileView(viewModel: viewModel)
                    } label: {
                        HStack(spacing: 14) {
                            UserAvatarView(
                                url: authViewModel.currentUser?.profilePictureUrl,
                                initials: String((authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "U").prefix(1)).uppercased(),
                                size: 56
                            )

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "Pengguna")
                                        .font(.headline)
                                        .foregroundStyle(.primary)

                                    if let role = authViewModel.currentUser?.role, !role.isEmpty {
                                        Text(role.uppercased())
                                            .font(.caption2.weight(.bold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(role.lowercased() == "admin" ? Color.purple.opacity(0.15) : Color.blue.opacity(0.15))
                                            .foregroundStyle(role.lowercased() == "admin" ? Color.purple : Color.blue)
                                            .clipShape(Capsule())
                                    }
                                }

                                Text("@\(authViewModel.currentUser?.username ?? "user")")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Text(authViewModel.currentUser?.email ?? "-")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    NavigationLink {
                        AccountSecurityView(viewModel: viewModel)
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Keamanan Akun")
                                    .font(.body)
                                    .foregroundStyle(.primary)
                                Text("Ubah kata sandi & proteksi akun")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "lock.shield.fill")
                                .foregroundStyle(.indigo)
                        }
                    }
                } header: {
                    Text("Akun")
                } footer: {
                    Text("Ketuk profil untuk memperbarui biodata atau nomor kontak Anda.")
                }

                // MARK: - Notifikasi & Pengingat
                Section {
                    HStack {
                        Label("Status Izin", systemImage: isNotificationAuthorized ? "bell.badge.fill" : "bell.slash.fill")
                            .foregroundStyle(isNotificationAuthorized ? .blue : .secondary)
                        Spacer()
                        Text(notificationStatusText)
                            .font(.subheadline)
                            .foregroundStyle(isNotificationAuthorized ? .green : .orange)
                    }

                    if !isNotificationAuthorized {
                        Button {
                            Task {
                                _ = await NotificationService.shared.requestAuthorization()
                                await updateNotificationStatus()
                            }
                        } label: {
                            HStack {
                                Spacer()
                                Label("Aktifkan Izin Notifikasi", systemImage: "bell.fill")
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.blue)
                    } else {
                        Button {
                            Task {
                                let testDate = Date().addingTimeInterval(5)
                                await NotificationService.shared.scheduleTaskReminder(
                                    id: "test-notification-\(Int(Date().timeIntervalSince1970))",
                                    title: "Pengingat TrackerThings",
                                    body: "Notifikasi lokal berhasil aktif! Ikon dan suara pengingat berfungsi sempurna.",
                                    triggerDate: testDate
                                )
                                testNotificationMessage = "Pengingat dijadwalkan dalam 5 detik. Kunci layar atau minimalkan app untuk melihat banner!"
                            }
                        } label: {
                            HStack {
                                Spacer()
                                Label("Uji Coba Pengingat (5 Detik)", systemImage: "timer")
                                Spacer()
                            }
                        }
                        .buttonStyle(.bordered)
                    }

                    if let message = testNotificationMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text(message)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("Notifikasi & Pengingat")
                } footer: {
                    Text("Pengingat otomatis akan muncul sebelum deadline tugas atau jadwal kuliah dimulai.")
                }

                // MARK: - Jaringan & Layanan Backend
                Section {
                    #if DEBUG
                    Button {
                        isShowingServerSettings = true
                    } label: {
                        HStack {
                            Label("Konfigurasi Server API (Debug)", systemImage: "server.rack")
                                .foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.footnote)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    #else
                    HStack {
                        Label("Server Resmi", systemImage: "cloud.fill")
                            .foregroundStyle(.primary)
                        Spacer()
                        Text("TrackerThings Cloud")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Label("Status Layanan", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Spacer()
                        Text("Aktif & Terhubung")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    #endif
                } header: {
                    Text("Layanan & Server")
                } footer: {
                    #if DEBUG
                    Text("Base URL aktif: \(AppConfig.shared.serverURLString)")
                        .font(.caption2)
                    #else
                    Text("Aplikasi terhubung ke backend resmi https://trackerthings.vercel.app/api")
                        .font(.caption2)
                    #endif
                }

                // MARK: - Tentang Aplikasi
                Section {
                    HStack(spacing: 12) {
                        BrandLogoView(size: 40, cornerRadius: 10, showShadow: false)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 0) {
                                Text("Tracker")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text("Things")
                                    .font(.headline)
                                    .foregroundStyle(
                                        LinearGradient(
                                            colors: [.blue, Color(red: 0.05, green: 0.72, blue: 0.88)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                            }

                            Text("Versi 1.0.0 (Build Release)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                } header: {
                    Text("Tentang Aplikasi")
                }

                // MARK: - Keluar dari Akun
                Section {
                    Button(role: .destructive) {
                        isShowingLogoutConfirmation = true
                    } label: {
                        HStack {
                            Spacer()
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Keluar dari Akun")
                                .fontWeight(.medium)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Pengaturan")
            .onAppear {
                viewModel.loadUserData(from: authViewModel.currentUser)
                Task {
                    await updateNotificationStatus()
                }
            }
            #if DEBUG
            .sheet(isPresented: $isShowingServerSettings) {
                ServerSettingsSheet()
            }
            #endif
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
    }

    private func updateNotificationStatus() async {
        let status = await NotificationService.shared.checkAuthorizationStatus()
        switch status {
        case .authorized, .ephemeral:
            isNotificationAuthorized = true
            notificationStatusText = "Diizinkan"
        case .denied:
            isNotificationAuthorized = false
            notificationStatusText = "Ditolak (Buka Pengaturan iOS)"
        case .notDetermined:
            isNotificationAuthorized = false
            notificationStatusText = "Belum Ditentukan"
        case .provisional:
            isNotificationAuthorized = true
            notificationStatusText = "Sementara"
        @unknown default:
            isNotificationAuthorized = false
            notificationStatusText = "Tidak Diketahui"
        }
    }
}
