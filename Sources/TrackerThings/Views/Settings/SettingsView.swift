import SwiftUI

/// Tampilan native SwiftUI untuk pengaturan aplikasi TrackerThings V2.
/// Mengorganisasikan akun, keamanan, notifikasi, layanan backend, dan sesi keluar secara terstruktur sesuai Apple HIG.
public struct SettingsView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel = SettingsViewModel()
    #if DEBUG
    @State private var isShowingServerSettings: Bool = false
    #endif
    @State private var isShowingLogoutConfirmation: Bool = false
    @State private var notificationStatusText: String = "Memeriksa..."
    @State private var isNotificationAuthorized: Bool = false
    @State private var testingCategory: String? = nil
    @State private var testNotificationMessage: String? = nil
    @State private var testNotificationSuccess: Bool = true

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                if viewModel.isOffline {
                    Section {
                        OfflineBannerView(
                            message: "Mode offline aktif. Pengaturan profil dan kata sandi memerlukan koneksi server."
                        )
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }

                // MARK: - Akun & Profil Pengguna
                Section {
                    NavigationLink {
                        EditProfileView(viewModel: viewModel)
                    } label: {
                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                            UserAvatarView(
                                url: authViewModel.currentUser?.profilePictureUrl,
                                initials: String((authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "U").prefix(1)).uppercased(),
                                size: 52
                            )

                            VStack(alignment: .leading, spacing: 3) {
                                Text(authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "Pengguna")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)

                                Text("@\(authViewModel.currentUser?.username ?? "user")")
                                    .font(AppTheme.Typography.secondary)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)

                                Text(authViewModel.currentUser?.email ?? "-")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                            }
                        }
                        .padding(.vertical, 4)
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                    }

                    NavigationLink {
                        AccountSecurityView(viewModel: viewModel)
                    } label: {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Keamanan Akun")
                                    .font(AppTheme.Typography.body)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                Text("Ubah kata sandi & enkripsi akun")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                        } icon: {
                            Image(systemName: "lock.shield.fill")
                                .font(.body)
                                .foregroundStyle(Color.indigo)
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                    }
                } header: {
                    Text("Akun Pengguna")
                } footer: {
                    Text("Ketuk profil untuk memperbarui nama lengkap, nomor telepon, atau foto profil Anda.")
                }

                // MARK: - Notifikasi & Pengingat
                Section {
                    HStack {
                        Label {
                            Text("Status Izin Notifikasi")
                                .font(AppTheme.Typography.body)
                        } icon: {
                            Image(systemName: isNotificationAuthorized ? "bell.badge.fill" : "bell.slash.fill")
                                .foregroundStyle(isNotificationAuthorized ? AppTheme.Colors.info : AppTheme.Colors.textSecondary)
                        }

                        Spacer()

                        Text(notificationStatusText)
                            .font(AppTheme.Typography.badge)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(isNotificationAuthorized ? AppTheme.Colors.successBackground : AppTheme.Colors.warningBackground)
                            .foregroundStyle(isNotificationAuthorized ? AppTheme.Colors.success : AppTheme.Colors.warning)
                            .clipShape(Capsule())
                    }
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)

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
                                    .font(AppTheme.Typography.cardTitle)
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                            .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(AppTheme.Colors.brandPrimary)
                    } else {
                        // Kategori Pengingat Granular
                        Toggle(isOn: $viewModel.notificationPreferences.isClassReminderEnabled) {
                            Label("Pengingat Jadwal Kuliah", systemImage: "clock.badge")
                                .font(AppTheme.Typography.body)
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                        .onChange(of: viewModel.notificationPreferences.isClassReminderEnabled) { _, _ in
                            viewModel.updateNotificationPreferences()
                        }

                        Toggle(isOn: $viewModel.notificationPreferences.isTaskReminderEnabled) {
                            Label("Pengingat Deadline Tugas", systemImage: "checklist")
                                .font(AppTheme.Typography.body)
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                        .onChange(of: viewModel.notificationPreferences.isTaskReminderEnabled) { _, _ in
                            viewModel.updateNotificationPreferences()
                        }

                        Toggle(isOn: $viewModel.notificationPreferences.isExamReminderEnabled) {
                            Label("Pengingat Jadwal Ujian", systemImage: "graduationcap")
                                .font(AppTheme.Typography.body)
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                        .onChange(of: viewModel.notificationPreferences.isExamReminderEnabled) { _, _ in
                            viewModel.updateNotificationPreferences()
                        }

                        // Uji Coba Pengiriman Notifikasi (Dengan Status Loading & Anti Double-Submit)
                        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                            Text("Uji Coba Pengiriman Notifikasi (Delay 5 Detik)")
                                .font(AppTheme.Typography.captionBold)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .padding(.top, 4)

                            // 1. Uji Notifikasi Tugas
                            Button {
                                guard testingCategory == nil else { return }
                                testingCategory = "Tugas"
                                Task {
                                    let ok = await NotificationService.shared.scheduleTestNotification(
                                        delaySeconds: 5,
                                        category: "Tugas",
                                        destination: "tasks"
                                    )
                                    testNotificationSuccess = ok
                                    testNotificationMessage = ok
                                        ? "Notifikasi Tugas dijadwalkan (5 detik). Minimalkan app untuk melihat banner!"
                                        : "Gagal menjadwalkan notifikasi tugas. Pastikan izin notifikasi aktif."
                                    testingCategory = nil
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "checklist")
                                        .foregroundStyle(AppTheme.Colors.brandPrimary)
                                    Text("Uji Notifikasi Tugas")
                                        .font(AppTheme.Typography.cardTitle)
                                        .foregroundStyle(AppTheme.Colors.textPrimary)
                                    Spacer()
                                    if testingCategory == "Tugas" {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                        Image(systemName: "paperplane")
                                            .font(.caption)
                                            .foregroundStyle(AppTheme.Colors.brandPrimary)
                                    }
                                }
                                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(testingCategory != nil)

                            Divider()

                            // 2. Uji Notifikasi Kuliah
                            Button {
                                guard testingCategory == nil else { return }
                                testingCategory = "Kuliah"
                                Task {
                                    let ok = await NotificationService.shared.scheduleTestNotification(
                                        delaySeconds: 5,
                                        category: "Kuliah",
                                        destination: "courses"
                                    )
                                    testNotificationSuccess = ok
                                    testNotificationMessage = ok
                                        ? "Notifikasi Kuliah dijadwalkan (5 detik). Minimalkan app untuk melihat banner!"
                                        : "Gagal menjadwalkan notifikasi kuliah. Pastikan izin notifikasi aktif."
                                    testingCategory = nil
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "book")
                                        .foregroundStyle(AppTheme.Colors.brandAccent)
                                    Text("Uji Notifikasi Kuliah")
                                        .font(AppTheme.Typography.cardTitle)
                                        .foregroundStyle(AppTheme.Colors.textPrimary)
                                    Spacer()
                                    if testingCategory == "Kuliah" {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                        Image(systemName: "paperplane")
                                            .font(.caption)
                                            .foregroundStyle(AppTheme.Colors.brandAccent)
                                    }
                                }
                                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(testingCategory != nil)

                            Divider()

                            // 3. Uji Notifikasi Ujian
                            Button {
                                guard testingCategory == nil else { return }
                                testingCategory = "Ujian"
                                Task {
                                    let ok = await NotificationService.shared.scheduleTestNotification(
                                        delaySeconds: 5,
                                        category: "Ujian",
                                        destination: "exams"
                                    )
                                    testNotificationSuccess = ok
                                    testNotificationMessage = ok
                                        ? "Notifikasi Ujian dijadwalkan (5 detik). Minimalkan app untuk melihat banner!"
                                        : "Gagal menjadwalkan notifikasi ujian. Pastikan izin notifikasi aktif."
                                    testingCategory = nil
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "graduationcap")
                                        .foregroundStyle(Color.indigo)
                                    Text("Uji Notifikasi Ujian")
                                        .font(AppTheme.Typography.cardTitle)
                                        .foregroundStyle(AppTheme.Colors.textPrimary)
                                    Spacer()
                                    if testingCategory == "Ujian" {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                        Image(systemName: "paperplane")
                                            .font(.caption)
                                            .foregroundStyle(Color.indigo)
                                    }
                                }
                                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(testingCategory != nil)
                        }

                        // Status Hasil Notifikasi Testing
                        if let message = testNotificationMessage {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: testNotificationSuccess ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                    .foregroundStyle(testNotificationSuccess ? AppTheme.Colors.success : AppTheme.Colors.urgent)
                                    .padding(.top, 2)
                                Text(message)
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(testNotificationSuccess ? AppTheme.Colors.textSecondary : AppTheme.Colors.urgent)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                } header: {
                    Text("Notifikasi & Pengingat")
                } footer: {
                    Text("Pengingat jadwal kuliah dan deadline ujian/tugas berulang otomatis dijadwalkan secara lokal di perangkat.")
                }

                // MARK: - Jaringan & Layanan Backend
                Section {
                    HStack {
                        Label {
                            Text("Status Sinkronisasi")
                                .font(AppTheme.Typography.body)
                        } icon: {
                            switch viewModel.connectionStatus {
                            case .checking:
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .foregroundStyle(AppTheme.Colors.brandAccent)
                            case .connected:
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(AppTheme.Colors.success)
                            case .unreachable:
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(AppTheme.Colors.warning)
                            }
                        }

                        Spacer()

                        switch viewModel.connectionStatus {
                        case .checking:
                            HStack(spacing: 6) {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Memeriksa...")
                                    .font(AppTheme.Typography.secondary)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                        case .connected:
                            Text("Terhubung")
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(AppTheme.Colors.successBackground)
                                .foregroundStyle(AppTheme.Colors.success)
                                .clipShape(Capsule())
                        case .unreachable:
                            Button {
                                Task {
                                    await viewModel.checkServerConnection()
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Text("Coba Lagi")
                                        .font(AppTheme.Typography.badge)
                                    Image(systemName: "arrow.clockwise")
                                        .font(.caption2)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.warningBackground)
                                .foregroundStyle(AppTheme.Colors.warning)
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)

                    #if DEBUG
                    Button {
                        isShowingServerSettings = true
                    } label: {
                        HStack {
                            Label("Konfigurasi Server API (Debug)", systemImage: "server.rack")
                                .font(AppTheme.Typography.body)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.footnote)
                                .foregroundStyle(AppTheme.Colors.textTertiary)
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                    }
                    #endif
                } header: {
                    Text("Layanan & Server")
                } footer: {
                    #if DEBUG
                    Text("Base URL server saat ini: \(AppConfig.shared.serverURLString)")
                    #else
                    Text("Status konektivitas aplikasi dengan server database PostgreSQL internal.")
                    #endif
                }

                // MARK: - Tentang Aplikasi
                Section {
                    HStack(spacing: AppTheme.Metrics.spacingMedium) {
                        BrandLogoView(size: 40, cornerRadius: 10, showShadow: false)

                        VStack(alignment: .leading, spacing: 2) {
                            BrandWordmarkView(size: 18, onDarkBackground: false)

                            Text("Versi 1.0.0 (Native iOS)")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                        }
                    }
                    .padding(.vertical, 2)
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)
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
                                .font(AppTheme.Typography.cardTitle)
                                .fontWeight(.semibold)
                            Spacer()
                        }
                        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                        .contentShape(Rectangle())
                    }
                }
            }
            .navigationTitle("Pengaturan")
            .onAppear {
                viewModel.loadUserData(from: authViewModel.currentUser)
                Task {
                    await updateNotificationStatus()
                    await viewModel.checkServerConnection()
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
