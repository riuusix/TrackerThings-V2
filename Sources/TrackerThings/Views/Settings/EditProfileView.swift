import SwiftUI
import PhotosUI

/// Tampilan native SwiftUI untuk mengedit biodata profil pengguna TrackerThings V2.
/// Mendukung pemilihan foto via PhotosPicker dengan kompresi lokal, upload ke server,
/// input URL opsional, validasi instan, loading state, dan toast feedback.
public struct EditProfileView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss
    @Bindable var viewModel: SettingsViewModel
    @State private var toast: FeedbackToastData?
    @State private var selectedPhotoItem: PhotosPickerItem? = nil

    public init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        Form {
            // MARK: - Header Avatar Pratinjau & Pemilih Foto
            Section {
                VStack(spacing: AppTheme.Metrics.spacingMedium) {
                    ZStack(alignment: .bottomTrailing) {
                        UserAvatarView(
                            url: viewModel.profilePictureUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                ? authViewModel.currentUser?.profilePictureUrl
                                : viewModel.profilePictureUrl,
                            initials: String((viewModel.fullName.isEmpty ? (authViewModel.currentUser?.username ?? "U") : viewModel.fullName).prefix(1)).uppercased(),
                            size: 84
                        )

                        if viewModel.isUploadingAvatar {
                            ProgressView()
                                .tint(.white)
                                .frame(width: 84, height: 84)
                                .background(Color.black.opacity(0.45))
                                .clipShape(Circle())
                        }

                        PhotosPicker(
                            selection: $selectedPhotoItem,
                            matching: .images,
                            photoLibrary: .shared()
                        ) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(7)
                                .background(AppTheme.Colors.brandPrimary)
                                .clipShape(Circle())
                                .overlay(
                                    Circle()
                                        .stroke(Color(uiColor: .systemBackground), lineWidth: 2)
                                )
                                .shadow(radius: 2)
                        }
                        .disabled(viewModel.isUploadingAvatar || viewModel.isOffline)
                        .accessibilityLabel("Pilih Foto Profil Baru")
                    }

                    VStack(spacing: 3) {
                        Text(viewModel.fullName.isEmpty ? (authViewModel.currentUser?.fullName ?? "Nama Pengguna") : viewModel.fullName)
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.textPrimary)

                        Text("@\(authViewModel.currentUser?.username ?? "user")")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)

                        PhotosPicker(
                            selection: $selectedPhotoItem,
                            matching: .images,
                            photoLibrary: .shared()
                        ) {
                            Text(viewModel.isUploadingAvatar ? "Mengunggah..." : "Pilih dari Galeri")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(viewModel.isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.brandPrimary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.neutralBackground)
                                .clipShape(Capsule())
                        }
                        .disabled(viewModel.isUploadingAvatar || viewModel.isOffline)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            // MARK: - Identitas Akun (Read-only)
            Section {
                HStack {
                    Label("Username", systemImage: "person.text.rectangle")
                        .font(AppTheme.Typography.body)
                    Spacer()
                    Text("@\(authViewModel.currentUser?.username ?? "-")")
                        .font(AppTheme.Typography.body)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
                .frame(minHeight: AppTheme.Metrics.minTouchTarget)

                HStack {
                    Label("Email Utama", systemImage: "envelope")
                        .font(AppTheme.Typography.body)
                    Spacer()
                    Text(authViewModel.currentUser?.email ?? "-")
                        .font(AppTheme.Typography.body)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
            } header: {
                Text("Identitas Akun (Sistem)")
            } footer: {
                Text("Username dan email utama terikat permanen dengan akun Anda dan dikelola oleh sistem.")
            }

            // MARK: - Biodata yang Dapat Diedit
            Section {
                // Nama Lengkap
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    HStack {
                        Text("Nama Lengkap")
                            .font(AppTheme.Typography.captionBold)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                        Text("*")
                            .font(AppTheme.Typography.captionBold)
                            .foregroundStyle(AppTheme.Colors.urgent)
                    }

                    TextField("Nama Lengkap Anda", text: $viewModel.fullName)
                        .font(AppTheme.Typography.body)
                        .textContentType(.name)
                        .autocorrectionDisabled()
                        .frame(minHeight: 36)

                    if !viewModel.isNameValid {
                        Text("Nama lengkap tidak boleh kosong.")
                            .font(AppTheme.Typography.badge)
                            .foregroundStyle(AppTheme.Colors.urgent)
                    }
                }
                .padding(.vertical, 2)

                // Nomor Telepon
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    Text("Nomor Telepon (Opsional)")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    TextField("Contoh: 081234567890", text: $viewModel.phoneNumber)
                        .font(AppTheme.Typography.body)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .frame(minHeight: 36)
                }
                .padding(.vertical, 2)

                // URL Foto Profil
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                    Text("URL Foto Profil (Opsional)")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    TextField("https://...", text: $viewModel.profilePictureUrl)
                        .font(AppTheme.Typography.body)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .frame(minHeight: 36)
                }
                .padding(.vertical, 2)
            } header: {
                Text("Data Pribadi")
            } footer: {
                Text("URL foto profil mendukung link gambar publik langsung (HTTPS). Avatar di atas akan otomatis memperbarui tampilan.")
            }

            // MARK: - Tombol Simpan Profil
            Section {
                Button {
                    guard !viewModel.isLoadingProfile, !viewModel.isOffline, viewModel.isNameValid else { return }
                    Task {
                        if let updatedUser = await viewModel.saveProfile() {
                            authViewModel.currentUser = updatedUser
                            toast = FeedbackToastData(message: "Profil berhasil diperbarui!", severity: .success)
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
                        Text(viewModel.isLoadingProfile ? "Menyimpan Perubahan..." : "Simpan Profil")
                            .font(AppTheme.Typography.cardTitle)
                            .fontWeight(.semibold)
                        Spacer()
                    }
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                }
                .buttonStyle(.borderedProminent)
                .tint(AppTheme.Colors.brandPrimary)
                .disabled(!viewModel.isNameValid || viewModel.isLoadingProfile || viewModel.isOffline)
            } footer: {
                if viewModel.isOffline {
                    HStack(spacing: 6) {
                        Image(systemName: "wifi.slash")
                        Text("Perangkat sedang offline. Sambungkan ke internet untuk memperbarui profil.")
                    }
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.warning)
                }
            }
        }
        .navigationTitle("Edit Profil")
        .navigationBarTitleDisplayMode(.inline)
        .feedbackToast(toast: $toast)
        .onAppear {
            viewModel.loadUserData(from: authViewModel.currentUser)
        }
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let item = newItem else { return }
            Task {
                await handlePhotoSelection(item)
            }
        }
    }

    private func handlePhotoSelection(_ item: PhotosPickerItem) async {
        guard !viewModel.isOffline else {
            toast = FeedbackToastData(message: "Tidak dapat mengunggah foto saat offline.", severity: .warning)
            selectedPhotoItem = nil
            return
        }

        do {
            guard let rawData = try await item.loadTransferable(type: Data.self) else {
                toast = FeedbackToastData(message: "Gagal membaca data gambar yang dipilih.", severity: .error)
                selectedPhotoItem = nil
                return
            }

            // Validasi & kompresi ukuran gambar bila diperlukan (target <= 2MB, max dimensi 1024x1024)
            #if canImport(UIKit)
            let processedData: Data
            if let uiImage = UIImage(data: rawData) {
                let maxDimension: CGFloat = 1024
                let originalSize = uiImage.size
                let targetSize: CGSize
                if originalSize.width > maxDimension || originalSize.height > maxDimension {
                    let ratio = min(maxDimension / originalSize.width, maxDimension / originalSize.height)
                    targetSize = CGSize(width: originalSize.width * ratio, height: originalSize.height * ratio)
                } else {
                    targetSize = originalSize
                }

                let renderer = UIGraphicsImageRenderer(size: targetSize)
                let resizedImage = renderer.image { _ in
                    uiImage.draw(in: CGRect(origin: .zero, size: targetSize))
                }
                processedData = resizedImage.jpegData(compressionQuality: 0.8) ?? rawData
            } else {
                processedData = rawData
            }
            #else
            let processedData = rawData
            #endif

            if let updatedUser = await viewModel.uploadAvatar(data: processedData, mimeType: "image/jpeg", fileName: "avatar.jpg") {
                authViewModel.currentUser = updatedUser
                toast = FeedbackToastData(message: "Foto profil berhasil diperbarui!", severity: .success)
            } else if let errorMsg = viewModel.errorMessage {
                toast = FeedbackToastData(message: errorMsg, severity: .error)
            }
        } catch {
            toast = FeedbackToastData(message: "Gagal memproses gambar: \(error.localizedDescription)", severity: .error)
        }
        selectedPhotoItem = nil
    }
}
