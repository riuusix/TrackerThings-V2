import SwiftUI

/// Tampilan native SwiftUI untuk mengedit biodata profil pengguna.
/// Menampilkan avatar, nama lengkap, nomor telepon, dan URL foto profil dengan validasi form dan loading state.
public struct EditProfileView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss
    @Bindable var viewModel: SettingsViewModel
    @State private var toast: FeedbackToastData?

    public init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        Form {
            // MARK: - Header Avatar Pratinjau
            Section {
                VStack(spacing: 12) {
                    UserAvatarView(
                        url: viewModel.profilePictureUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? authViewModel.currentUser?.profilePictureUrl
                            : viewModel.profilePictureUrl,
                        initials: String((viewModel.fullName.isEmpty ? (authViewModel.currentUser?.username ?? "U") : viewModel.fullName).prefix(1)).uppercased(),
                        size: 80
                    )

                    VStack(spacing: 4) {
                        Text(authViewModel.currentUser?.fullName ?? authViewModel.currentUser?.username ?? "Pengguna")
                            .font(.headline)
                            .foregroundStyle(.primary)

                        Text("@\(authViewModel.currentUser?.username ?? "user")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            // MARK: - Identitas Akun (Read-only)
            Section {
                LabeledContent {
                    Text("@\(authViewModel.currentUser?.username ?? "-")")
                        .foregroundStyle(.secondary)
                } label: {
                    Text("Username")
                }

                LabeledContent {
                    Text(authViewModel.currentUser?.email ?? "-")
                        .foregroundStyle(.secondary)
                } label: {
                    Text("Email")
                }
            } header: {
                Text("Identitas Akun")
            } footer: {
                Text("Username dan email utama terikat dengan akun Anda dan dikelola oleh sistem.")
            }

            // MARK: - Biodata yang Dapat Diedit
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

                VStack(alignment: .leading, spacing: 6) {
                    Text("URL Foto Profil (Opsional)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("https://...", text: $viewModel.profilePictureUrl)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            } header: {
                Text("Data Pribadi")
            } footer: {
                Text("Gunakan URL gambar publik (misalnya Gravatar, GitHub, atau link HTTPS) untuk memperbarui foto profil.")
            }

            // MARK: - Tombol Simpan Profil
            Section {
                Button {
                    guard !viewModel.isLoadingProfile else { return }
                    Task {
                        if let updatedUser = await viewModel.saveProfile() {
                            authViewModel.currentUser = updatedUser
                            toast = FeedbackToastData(message: "Profil berhasil diperbarui!", severity: .success)
                            try? await Task.sleep(nanoseconds: 600_000_000)
                            dismiss()
                        } else if let errorMsg = viewModel.errorMessage {
                            toast = FeedbackToastData(message: errorMsg, severity: .error)
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
            }
        }
        .navigationTitle("Edit Profil")
        .navigationBarTitleDisplayMode(.inline)
        .feedbackToast(toast: $toast)
        .onAppear {
            viewModel.loadUserData(from: authViewModel.currentUser)
        }
    }
}

