import SwiftUI

/// Tampilan native SwiftUI untuk pengaturan profil pengguna dan keamanan akun.
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
                // MARK: - Kartu Informasi Akun
                Section {
                    HStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(LinearGradient(colors: [.blue, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing))
                                .frame(width: 58, height: 58)
                                .shadow(color: .blue.opacity(0.3), radius: 6, y: 3)

                            Text((authViewModel.currentUser?.username.prefix(1) ?? "U").uppercased())
                                .font(.title2.weight(.bold))
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
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

                            Text("@\(authViewModel.currentUser?.username ?? "user") • \(authViewModel.currentUser?.email ?? "-")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                } header: {
                    Text("Akun Terdaftar")
                }

                // MARK: - Banner Notifikasi Toast/Alert Inline
                if let errorMsg = viewModel.errorMessage {
                    Section {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(errorMsg)
                                .font(.subheadline)
                                .foregroundStyle(.red)
                            Spacer()
                            Button {
                                viewModel.clearMessages()
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if let successMsg = viewModel.successMessage {
                    Section {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text(successMsg)
                                .font(.subheadline)
                                .foregroundStyle(.green)
                            Spacer()
                            Button {
                                viewModel.clearMessages()
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                // MARK: - Form Edit Profil
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Nama Lengkap")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Nama Lengkap Anda", text: $viewModel.fullName)
                            .textContentType(.name)
                            .autocorrectionDisabled()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Nomor Telepon (Opsional)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("Contoh: 081234567890", text: $viewModel.phoneNumber)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                    }

                    Button {
                        Task {
                            if let updatedUser = await viewModel.saveProfile() {
                                authViewModel.currentUser = updatedUser
                            }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.isLoadingProfile {
                                ProgressView()
                                    .tint(.white)
                                    .padding(.trailing, 6)
                            }
                            Text(viewModel.isLoadingProfile ? "Menyimpan..." : "Simpan Profil")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!viewModel.isNameValid || viewModel.isLoadingProfile)
                } header: {
                    Text("Biodata & Tampilan")
                } footer: {
                    Text("Nama lengkap akan ditampilkan pada dashboard utama dan kartu tugas.")
                }

                // MARK: - Form Ganti Kata Sandi
                Section {
                    // Password Lama
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Kata Sandi Lama")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            if viewModel.isCurrentPasswordVisible {
                                TextField("Kata sandi saat ini", text: $viewModel.currentPassword)
                            } else {
                                SecureField("Kata sandi saat ini", text: $viewModel.currentPassword)
                            }
                            Button {
                                viewModel.isCurrentPasswordVisible.toggle()
                            } label: {
                                Image(systemName: viewModel.isCurrentPasswordVisible ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Password Baru
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Kata Sandi Baru")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            if viewModel.isNewPasswordVisible {
                                TextField("Minimal 6 karakter", text: $viewModel.newPassword)
                            } else {
                                SecureField("Minimal 6 karakter", text: $viewModel.newPassword)
                            }
                            Button {
                                viewModel.isNewPasswordVisible.toggle()
                            } label: {
                                Image(systemName: viewModel.isNewPasswordVisible ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Konfirmasi Password Baru
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Konfirmasi Kata Sandi Baru")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        HStack {
                            if viewModel.isConfirmPasswordVisible {
                                TextField("Ulangi kata sandi baru", text: $viewModel.confirmPassword)
                            } else {
                                SecureField("Ulangi kata sandi baru", text: $viewModel.confirmPassword)
                            }
                            Button {
                                viewModel.isConfirmPasswordVisible.toggle()
                            } label: {
                                Image(systemName: viewModel.isConfirmPasswordVisible ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Petunjuk Validasi Inline
                    if let hint = viewModel.passwordValidationMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "info.circle")
                            Text(hint)
                        }
                        .font(.caption2)
                        .foregroundStyle(.orange)
                    }

                    Button {
                        Task {
                            _ = await viewModel.savePassword()
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.isLoadingPassword {
                                ProgressView()
                                    .tint(.white)
                                    .padding(.trailing, 6)
                            }
                            Text(viewModel.isLoadingPassword ? "Mengubah Sandi..." : "Perbarui Kata Sandi")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.indigo)
                    .disabled(!viewModel.isPasswordFormValid || viewModel.isLoadingPassword)
                } header: {
                    Text("Keamanan & Kata Sandi")
                } footer: {
                    Text("Gunakan kombinasi minimal 6 karakter demi keamanan akun Anda.")
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
                                    title: "Pengingat TrackerThings-V2",
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

