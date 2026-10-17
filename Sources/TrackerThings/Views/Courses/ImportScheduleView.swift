import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// Tampilan native SwiftUI untuk mengimpor jadwal kuliah dari foto atau dokumen PDF.
/// Menyediakan pemilihan foto/dokumen, ekstraksi OCR lokal, opsi fallback ke Gemini Vision AI
/// dengan persetujuan eksplisit, tabel pengeditan data per kolom dengan indikator akurasi,
/// dan konfirmasi penyimpanan atomik.
public struct ImportScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var courseViewModel: CourseViewModel
    @State private var viewModel = ImportScheduleViewModel()

    @State private var selectedPhotoItem: PhotosPickerItem? = nil
    @State private var isShowingDocumentPicker: Bool = false
    @State private var showConsentDialog: Bool = false

    private let hariOptions = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

    public init(courseViewModel: CourseViewModel) {
        self.courseViewModel = courseViewModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppTheme.Metrics.spacingMedium) {
                    // MARK: - Banner Offline
                    if viewModel.isOffline {
                        OfflineBannerView(
                            message: "Perangkat offline. Pemrosesan OCR dan Vision AI memerlukan koneksi internet ke server."
                        )
                        .padding(.horizontal)
                    }

                    // MARK: - Pemilih File (Foto / PDF)
                    fileSelectionSection

                    // MARK: - Loading Progress
                    if viewModel.isLoading || viewModel.isVisionLoading {
                        loadingCard
                    }

                    // MARK: - Pesan Error
                    if let error = viewModel.errorMessage, !viewModel.isLoading, !viewModel.isVisionLoading {
                        errorCard(error: error)
                    }

                    // MARK: - Fallback AI Vision Banner (Jika OCR Kurang Optimal)
                    if viewModel.visionEligible && !viewModel.isLoading && !viewModel.isVisionLoading {
                        visionFallbackCard
                    }

                    // MARK: - Daftar Mata Kuliah Terdeteksi
                    if !viewModel.items.isEmpty && !viewModel.isLoading && !viewModel.isVisionLoading {
                        detectedItemsSection
                    }
                }
                .padding(.vertical)
            }
            .background(AppTheme.Colors.background)
            .navigationTitle("Impor Jadwal Kuliah")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Tutup") {
                        dismiss()
                    }
                    .font(AppTheme.Typography.body)
                }

                if !viewModel.items.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            viewModel.addNewRow()
                        } label: {
                            Label("Tambah Baris", systemImage: "plus")
                                .font(AppTheme.Typography.captionBold)
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if !viewModel.items.isEmpty && !viewModel.isLoading && !viewModel.isVisionLoading {
                    bottomActionBar
                }
            }
            .photosPicker(isPresented: .constant(false), selection: $selectedPhotoItem) // internal binding
            .onChange(of: selectedPhotoItem) { _, newItem in
                handlePhotoSelection(newItem)
            }
            .fileImporter(
                isPresented: $isShowingDocumentPicker,
                allowedContentTypes: [.pdf, .png, .jpeg],
                allowsMultipleSelection: false
            ) { result in
                handleDocumentSelection(result)
            }
            .confirmationDialog(
                "Persetujuan Pemrosesan Vision AI",
                isPresented: $showConsentDialog,
                titleVisibility: .visible
            ) {
                Button("Setuju & Proses dengan Vision AI") {
                    Task {
                        await viewModel.runVisionAIFallback()
                    }
                }
                Button("Batal", role: .cancel) {}
            } message: {
                Text("Gambar jadwal Anda akan dianalisis secara aman oleh layanan Google Gemini Vision untuk mengekstrak kolom tabel yang rumit. Data gambar tidak disimpan permanen oleh pihak ketiga.")
            }
            .feedbackToast(toast: $viewModel.toast)
        }
    }

    // MARK: - File Selection Section
    private var fileSelectionSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            Text("PILIH SUMBER JADWAL")
                .font(AppTheme.Typography.captionBold)
                .foregroundStyle(AppTheme.Colors.textSecondary)
                .padding(.horizontal)

            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                // Tombol Galeri Foto
                PhotosPicker(
                    selection: $selectedPhotoItem,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    VStack(spacing: 8) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 26))
                            .foregroundStyle(AppTheme.Colors.brandPrimary)
                        Text("Galeri Foto")
                            .font(AppTheme.Typography.cardTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Text("PNG, JPG, WebP")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.Colors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium)
                            .stroke(AppTheme.Colors.borderSubtle, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                // Tombol Dokumen PDF
                Button {
                    isShowingDocumentPicker = true
                } label: {
                    VStack(spacing: 8) {
                        Image(systemName: "doc.text.fill")
                            .font(.system(size: 26))
                            .foregroundStyle(Color.orange)
                        Text("Dokumen PDF")
                            .font(AppTheme.Typography.cardTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Text("PDF Digital / KRS")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.Colors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
                    .overlay(
                        RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium)
                            .stroke(AppTheme.Colors.borderSubtle, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)

            if !viewModel.selectedFileName.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: viewModel.isDocumentPdf ? "doc.fill" : "photo.fill")
                        .font(.caption)
                        .foregroundStyle(AppTheme.Colors.brandPrimary)
                    Text("File aktif: \(viewModel.selectedFileName)")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
                .padding(.horizontal)
                .padding(.top, 2)
            }
        }
    }

    // MARK: - Loading Card
    private var loadingCard: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
                .tint(AppTheme.Colors.brandPrimary)
            Text(viewModel.loadingMessage)
                .font(AppTheme.Typography.body)
                .foregroundStyle(AppTheme.Colors.textPrimary)
                .multilineTextAlignment(.center)
            Text("Harap tunggu beberapa saat...")
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal)
        .background(AppTheme.Colors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
        .padding(.horizontal)
    }

    // MARK: - Error Card
    private func errorCard(error: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(AppTheme.Colors.urgent)
                Text("Gagal Memproses")
                    .font(AppTheme.Typography.cardTitle)
                    .foregroundStyle(AppTheme.Colors.urgent)
            }

            Text(error)
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textSecondary)

            if viewModel.selectedFileData != nil {
                Button {
                    Task {
                        await viewModel.runOcrPreview()
                    }
                } label: {
                    Label("Coba Lagi", systemImage: "arrow.clockwise")
                        .font(AppTheme.Typography.captionBold)
                }
                .buttonStyle(.bordered)
                .tint(AppTheme.Colors.brandPrimary)
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(AppTheme.Colors.urgentBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
        .padding(.horizontal)
    }

    // MARK: - Vision Fallback Card
    private var visionFallbackCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.title3)
                    .foregroundStyle(Color.purple)
                Text("Tingkatkan dengan Vision AI")
                    .font(AppTheme.Typography.sectionHeader)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
            }

            Text("Ekstraksi OCR lokal menemukan beberapa kolom yang kurang teratur atau tidak lengkap. Anda dapat menggunakan kecerdasan Gemini Vision AI untuk membaca tabel jadwal secara lebih presisi.")
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textSecondary)

            Button {
                showConsentDialog = true
            } label: {
                HStack {
                    Spacer()
                    Image(systemName: "sparkles")
                    Text("Gunakan Bantuan Vision AI")
                        .font(AppTheme.Typography.cardTitle)
                        .fontWeight(.semibold)
                    Spacer()
                }
                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.purple)
        }
        .padding()
        .background(Color.purple.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium)
                .stroke(Color.purple.opacity(0.25), lineWidth: 1)
        )
        .padding(.horizontal)
    }

    // MARK: - Detected Items Section
    private var detectedItemsSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            HStack {
                Text("HASIL DETEKSI JADWAL (\(viewModel.items.count) MATA KULIAH)")
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(AppTheme.Colors.textSecondary)

                Spacer()

                let needsReviewCount = viewModel.items.filter { $0.needsReview }.count
                if needsReviewCount > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.circle.fill")
                        Text("\(needsReviewCount) Perlu Ditinjau")
                    }
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppTheme.Colors.warningBackground)
                    .foregroundStyle(AppTheme.Colors.warning)
                    .clipShape(Capsule())
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Akurat")
                    }
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppTheme.Colors.successBackground)
                    .foregroundStyle(AppTheme.Colors.success)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal)

            Text("Periksa dan sesuaikan nama mata kuliah, hari, jam, atau ruang sebelum menyimpan.")
                .font(AppTheme.Typography.caption)
                .foregroundStyle(AppTheme.Colors.textTertiary)
                .padding(.horizontal)

            ForEach($viewModel.items) { $item in
                itemEditorCard(item: $item)
            }
        }
    }

    // MARK: - Single Item Editor Card
    private func itemEditorCard(item: Binding<ImportScheduleItem>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header baris: Status & Hapus
            HStack {
                if item.wrappedValue.needsReview {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                        Text("Perlu Ditinjau")
                    }
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.Colors.warningBackground)
                    .foregroundStyle(AppTheme.Colors.warning)
                    .clipShape(Capsule())
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Akurasi Tinggi")
                    }
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(AppTheme.Colors.successBackground)
                    .foregroundStyle(AppTheme.Colors.success)
                    .clipShape(Capsule())
                }

                Spacer()

                Button {
                    viewModel.removeItem(id: item.wrappedValue.id)
                } label: {
                    Image(systemName: "trash")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.Colors.urgent)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Hapus baris ini")
            }

            // Warning chips jika ada alasan review
            if let reasons = item.wrappedValue.reviewReasons, !reasons.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(reasons, id: \.self) { reason in
                        HStack(spacing: 4) {
                            Image(systemName: "info.circle")
                                .font(.caption2)
                            Text(reason)
                                .font(.system(size: 11))
                        }
                        .foregroundStyle(AppTheme.Colors.warning)
                    }
                }
                .padding(6)
                .background(AppTheme.Colors.warningBackground.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            // Nama Mata Kuliah
            VStack(alignment: .leading, spacing: 4) {
                Text("Nama Mata Kuliah")
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                TextField("Contoh: Rekayasa Perangkat Lunak", text: item.namaMatkul)
                    .font(AppTheme.Typography.body)
                    .padding(8)
                    .background(AppTheme.Colors.background)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Hari & Jam
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Hari")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    Picker("Hari", selection: item.hari) {
                        ForEach(hariOptions, id: \.self) { h in
                            Text(h).tag(h)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(4)
                    .background(AppTheme.Colors.background)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Mulai")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    TextField("08:00", text: item.waktuMulai)
                        .font(AppTheme.Typography.body)
                        .padding(8)
                        .background(AppTheme.Colors.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Selesai")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    TextField("10:00", text: item.waktuSelesai)
                        .font(AppTheme.Typography.body)
                        .padding(8)
                        .background(AppTheme.Colors.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            // Ruang & SKS
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ruang / Lokasi")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    TextField("Contoh: D.302", text: Binding(
                        get: { item.wrappedValue.lokasi ?? item.wrappedValue.ruang ?? "" },
                        set: {
                            item.wrappedValue.lokasi = $0
                            item.wrappedValue.ruang = $0
                        }
                    ))
                    .font(AppTheme.Typography.body)
                    .padding(8)
                    .background(AppTheme.Colors.background)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("SKS: \(item.wrappedValue.sks ?? 2)")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    Stepper("", value: Binding(
                        get: { item.wrappedValue.sks ?? 2 },
                        set: { item.wrappedValue.sks = $0 }
                    ), in: 1...8)
                    .labelsHidden()
                    .frame(height: 38)
                }
            }

            // Dosen
            VStack(alignment: .leading, spacing: 4) {
                Text("Dosen Pengampu (Opsional)")
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                TextField("Nama dosen pengampu", text: Binding(
                    get: { item.wrappedValue.dosen ?? "" },
                    set: { item.wrappedValue.dosen = $0.isEmpty ? nil : $0 }
                ))
                .font(AppTheme.Typography.body)
                .padding(8)
                .background(AppTheme.Colors.background)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding()
        .background(AppTheme.Colors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium)
                .stroke(item.wrappedValue.needsReview ? AppTheme.Colors.warning.opacity(0.4) : AppTheme.Colors.borderSubtle, lineWidth: 1)
        )
        .padding(.horizontal)
    }

    // MARK: - Bottom Action Bar
    private var bottomActionBar: some View {
        VStack(spacing: 8) {
            Divider()

            Toggle(isOn: $viewModel.learnCorrections) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("Pelajari Koreksi Jadwal")
                        .font(AppTheme.Typography.body)
                        .foregroundStyle(AppTheme.Colors.textPrimary)
                    Text("Simpan preferensi nama & kode mata kuliah untuk impor selanjutnya")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
            }
            .padding(.horizontal)

            Button {
                Task {
                    await viewModel.confirmAndSave {
                        Task {
                            await courseViewModel.fetchCourses()
                            await NotificationService.shared.syncRemindersFromCache()
                            dismiss()
                        }
                    }
                }
            } label: {
                HStack {
                    Spacer()
                    if viewModel.isConfirming {
                        ProgressView()
                            .tint(.white)
                            .padding(.trailing, 6)
                    }
                    Text(viewModel.isConfirming ? "Menyimpan ke Jadwal..." : "Simpan \(viewModel.items.count) Mata Kuliah")
                        .font(AppTheme.Typography.cardTitle)
                        .fontWeight(.semibold)
                    Spacer()
                }
                .frame(minHeight: AppTheme.Metrics.minTouchTarget)
            }
            .buttonStyle(.borderedProminent)
            .tint(AppTheme.Colors.brandPrimary)
            .disabled(viewModel.items.isEmpty || viewModel.isConfirming || viewModel.isOffline)
            .padding(.horizontal)
            .padding(.bottom, 6)
        }
        .background(AppTheme.Colors.cardBackground)
    }

    // MARK: - Handlers
    private func handlePhotoSelection(_ item: PhotosPickerItem?) {
        guard let item = item else { return }
        Task {
            if let data = try? await item.loadTransferable(type: Data.self) {
                await MainActor.run {
                    viewModel.handleFileSelected(data: data, fileName: "jadwal_foto.jpg", mimeType: "image/jpeg")
                }
            }
        }
    }

    private func handleDocumentSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            let accessing = url.startAccessingSecurityScopedResource()
            defer {
                if accessing { url.stopAccessingSecurityScopedResource() }
            }

            guard let data = try? Data(contentsOf: url) else {
                viewModel.errorMessage = "Tidak dapat membaca file dokumen."
                return
            }

            let fileName = url.lastPathComponent
            let isPdf = fileName.lowercased().hasSuffix(".pdf")
            let mime = isPdf ? "application/pdf" : "image/jpeg"
            viewModel.handleFileSelected(data: data, fileName: fileName, mimeType: mime)

        case .failure(let err):
            viewModel.errorMessage = "Gagal memilih dokumen: \(err.localizedDescription)"
        }
    }
}

