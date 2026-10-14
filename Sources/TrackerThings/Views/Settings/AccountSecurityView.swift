import SwiftUI

/// Tampilan native SwiftUI untuk keamanan akun, penggantian kata sandi, dan panduan keamanan data.
/// Memastikan tidak ada data sensitif yang terekspos, dilengkapi indikator kekuatan kata sandi,
/// toggle visibilitas dengan target sentuh 44×44pt, serta feedback toast.
public struct AccountSecurityView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss
    @Bindable var viewModel: SettingsViewModel
    @State private var toast: FeedbackToastData?

    public init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        Form {
            // MARK: - Banner Proteksi Akun
            Section {
                HStack(spacing: AppTheme.Metrics.spacingMedium) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [AppTheme.Colors.brandPrimary, Color.indigo],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Proteksi Enkripsi Akun")
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Text("Kata sandi dilindungi menggunakan hash kriptografis standar industri. Sistem tidak pernah menyimpan atau menampilkan teks sandi terbuka.")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                }
                .padding(.vertical, 4)
            }

            // MARK: - Form Ganti Kata Sandi
            Section {
                // Kata Sandi Saat Ini
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    Text("Kata Sandi Saat Ini")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    HStack {
                        if viewModel.isCurrentPasswordVisible {
                            TextField("Masukkan kata sandi saat ini", text: $viewModel.currentPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Masukkan kata sandi saat ini", text: $viewModel.currentPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        Button {
                            viewModel.isCurrentPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isCurrentPasswordVisible ? "eye.slash" : "eye")
                                .font(.body)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .frame(
                                    width: AppTheme.Metrics.minTouchTarget,
                                    height: AppTheme.Metrics.minTouchTarget,
                                    alignment: .trailing
                                )
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)

                // Kata Sandi Baru
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    Text("Kata Sandi Baru")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    HStack {
                        if viewModel.isNewPasswordVisible {
                            TextField("Minimal 6 karakter", text: $viewModel.newPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Minimal 6 karakter", text: $viewModel.newPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        Button {
                            viewModel.isNewPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isNewPasswordVisible ? "eye.slash" : "eye")
                                .font(.body)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .frame(
                                    width: AppTheme.Metrics.minTouchTarget,
                                    height: AppTheme.Metrics.minTouchTarget,
                                    alignment: .trailing
                                )
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)

                // Konfirmasi Kata Sandi Baru
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    Text("Konfirmasi Kata Sandi Baru")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    HStack {
                        if viewModel.isConfirmPasswordVisible {
                            TextField("Ulangi kata sandi baru", text: $viewModel.confirmPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Ulangi kata sandi baru", text: $viewModel.confirmPassword)
                                .font(AppTheme.Typography.body)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }

                        Button {
                            viewModel.isConfirmPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isConfirmPasswordVisible ? "eye.slash" : "eye")
                                .font(.body)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .frame(
                                    width: AppTheme.Metrics.minTouchTarget,
                                    height: AppTheme.Metrics.minTouchTarget,
                                    alignment: .trailing
                                )
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)

                // Checklist Persyaratan Kata Sandi
                VStack(alignment: .leading, spacing: 6) {
                    let hasLength = viewModel.newPassword.count >= 6
                    let matches = !viewModel.newPassword.isEmpty && viewModel.newPassword == viewModel.confirmPassword
                    let isDiff = !viewModel.currentPassword.isEmpty && !viewModel.newPassword.isEmpty && viewModel.currentPassword != viewModel.newPassword

                    HStack(spacing: 6) {
                        Image(systemName: hasLength ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(hasLength ? AppTheme.Colors.success : AppTheme.Colors.textTertiary)
                        Text("Panjang minimal 6 karakter")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(hasLength ? AppTheme.Colors.textPrimary : AppTheme.Colors.textSecondary)
                    }

                    HStack(spacing: 6) {
                        Image(systemName: matches ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(matches ? AppTheme.Colors.success : AppTheme.Colors.textTertiary)
                        Text("Konfirmasi kata sandi cocok")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(matches ? AppTheme.Colors.textPrimary : AppTheme.Colors.textSecondary)
                    }

                    HStack(spacing: 6) {
                        Image(systemName: isDiff ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(isDiff ? AppTheme.Colors.success : AppTheme.Colors.textTertiary)
                        Text("Berbeda dari kata sandi saat ini")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(isDiff ? AppTheme.Colors.textPrimary : AppTheme.Colors.textSecondary)
                    }
                }
                .padding(.vertical, 4)

                // Tombol Submit
                Button {
                    guard !viewModel.isLoadingPassword, !viewModel.isOffline, viewModel.isPasswordFormValid else { return }
                    Task {
                        let success = await viewModel.savePassword()
                        if success {
                            toast = FeedbackToastData(message: viewModel.successMessage ?? "Kata sandi berhasil diperbarui!", severity: .success)
                        } else if let errorMsg = viewModel.errorMessage {
                            toast = FeedbackToastData(message: errorMsg, severity: .error)
                        }
                    }
                } label: {
                    HStack {
                        Spacer()
                        if viewModel.isLoadingPassword {
                            ProgressView()
                                .tint(.white)
                                .padding(.trailing, 6)
                        }
                        Text(viewModel.isLoadingPassword ? "Memproses Sandi..." : "Perbarui Kata Sandi")
                            .font(AppTheme.Typography.cardTitle)
                            .fontWeight(.semibold)
                        Spacer()
                    }
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.Colors.brandPrimary)
                .disabled(!viewModel.isPasswordFormValid || viewModel.isLoadingPassword || viewModel.isOffline)
            } header: {
                Text("Ubah Kata Sandi")
            } footer: {
                if viewModel.isOffline {
                    HStack(spacing: 6) {
                        Image(systemName: "wifi.slash")
                        Text("Perangkat sedang offline. Hubungkan ke internet untuk memperbarui kata sandi.")
                    }
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.warning)
                }
            }

            // MARK: - Catatan Layanan & Keamanan
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle.fill")
                            .foregroundStyle(AppTheme.Colors.brandPrimary)
                        Text("Panduan Keamanan")
                            .font(AppTheme.Typography.cardTitle)
                    }

                    Text("Demi keamanan, hindari menggunakan kata sandi yang sama dengan akun lain. Jika Anda kehilangan akses masuk, hubungi administrator kampus atau gunakan menu pemulihan di portal web TrackerThings.")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
                .padding(.vertical, 4)
            } header: {
                Text("Informasi Layanan")
            }
        }
        .navigationTitle("Keamanan Akun")
        .navigationBarTitleDisplayMode(.inline)
        .feedbackToast(toast: $toast)
    }
}
