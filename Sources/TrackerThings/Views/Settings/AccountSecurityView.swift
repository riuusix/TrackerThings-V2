import SwiftUI

/// Tampilan native SwiftUI untuk keamanan akun, penggantian kata sandi, dan panduan pemulihan akun.
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
                HStack(spacing: 14) {
                    Image(systemName: "lock.shield.fill")
                        .font(.title)
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.blue, .indigo],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )

                    VStack(alignment: .leading, spacing: 3) {
                        Text("Enkripsi & Keamanan")
                            .font(.headline)
                            .foregroundStyle(.primary)
                        Text("Kata sandi akun Anda dilindungi dengan enkripsi hash bcrypt berstandar keamanan tinggi.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            // MARK: - Form Ganti Kata Sandi
            Section {
                // Password Lama
                VStack(alignment: .leading, spacing: 6) {
                    Text("Kata Sandi Saat Ini")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack {
                        if viewModel.isCurrentPasswordVisible {
                            TextField("Masukkan kata sandi saat ini", text: $viewModel.currentPassword)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Masukkan kata sandi saat ini", text: $viewModel.currentPassword)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                        Button {
                            viewModel.isCurrentPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isCurrentPasswordVisible ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
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
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Minimal 6 karakter", text: $viewModel.newPassword)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                        Button {
                            viewModel.isNewPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isNewPasswordVisible ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
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
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Ulangi kata sandi baru", text: $viewModel.confirmPassword)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                        Button {
                            viewModel.isConfirmPasswordVisible.toggle()
                        } label: {
                            Image(systemName: viewModel.isConfirmPasswordVisible ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Petunjuk Validasi Inline
                if let hint = viewModel.passwordValidationMessage {
                    HStack(spacing: 6) {
                        Image(systemName: "info.circle.fill")
                        Text(hint)
                    }
                    .font(.caption2)
                    .foregroundStyle(.orange)
                }

                // Tombol Submit
                Button {
                    guard !viewModel.isLoadingPassword, !viewModel.isOffline else { return }
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
                        Text(viewModel.isLoadingPassword ? "Memproses..." : "Perbarui Kata Sandi")
                            .fontWeight(.semibold)
                        Spacer()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.indigo)
                .disabled(!viewModel.isPasswordFormValid || viewModel.isLoadingPassword || viewModel.isOffline)
            } header: {
                Text("Ubah Kata Sandi")
            } footer: {
                if viewModel.isOffline {
                    Text("Perangkat sedang offline. Hubungkan ke internet untuk memperbarui kata sandi.")
                        .foregroundStyle(.orange)
                } else {
                    Text("Gunakan kombinasi minimal 6 karakter. Pastikan kata sandi baru berbeda dari kata sandi saat ini.")
                }
            }

            // MARK: - Catatan Pemulihan Akun & Layanan
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Image(systemName: "questionmark.circle.fill")
                            .foregroundStyle(.blue)
                        Text("Pemulihan Akun")
                            .font(.subheadline.weight(.semibold))
                    }
                    Text("Jika Anda lupa kata sandi, pemulihan akun dapat dilakukan melalui verifikasi pertanyaan keamanan di web TrackerThings. Autentikasi aplikasi dikelola langsung secara mandiri melalui database PostgreSQL internal.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
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

