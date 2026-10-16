import SwiftUI

/// Tampilan Detail Kelas Pengganti native SwiftUI untuk TrackerThings V2.
/// Menampilkan status penyelesaian, mata kuliah terkait, tanggal, jam mulai-selesai, lokasi, catatan,
/// serta aksi Tandai Selesai, Edit, dan Hapus permanen dengan konfirmasi.
public struct ReplacementClassDetailView: View {
    @Bindable var viewModel: DashboardViewModel
    public let replacementId: Int
    public let initialItem: KelasPenggantiItem?

    @Environment(\.dismiss) private var dismiss
    @State private var isPresentingEditSheet: Bool = false
    @State private var isConfirmingDelete: Bool = false
    @State private var isDeleting: Bool = false

    public init(
        replacementId: Int,
        initialItem: KelasPenggantiItem? = nil,
        viewModel: DashboardViewModel
    ) {
        self.replacementId = replacementId
        self.initialItem = initialItem
        self.viewModel = viewModel
    }

    private var liveItem: KelasPenggantiItem? {
        viewModel.replacementClasses.first(where: { $0.id == replacementId })
    }

    private var currentItem: KelasPenggantiItem? {
        liveItem ?? initialItem
    }

    private var isItemDeletedOrMissingAfterLoad: Bool {
        !viewModel.isLoading && liveItem == nil && (!viewModel.replacementClasses.isEmpty || !viewModel.courses.isEmpty)
    }

    private var relatedCourse: JadwalItem? {
        guard let item = currentItem else { return nil }
        return viewModel.courses.first(where: { $0.id == item.idJadwal })
    }

    private var courseTitle: String {
        relatedCourse?.namaMatkul ?? currentItem?.jadwal?.namaMatkul ?? "Kelas Pengganti"
    }

    private var courseCategory: String? {
        relatedCourse?.kategori ?? currentItem?.jadwal?.kategori
    }

    private func formattedFullDate(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "id_ID")
        df.dateFormat = "EEEE, d MMMM yyyy"
        return df.string(from: date)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSection) {
                if viewModel.isOffline {
                    OfflineBannerView(lastUpdatedText: viewModel.lastCacheDateText) {
                        Task {
                            await viewModel.loadDashboardData()
                        }
                    }
                    .padding(.horizontal)
                }

                if viewModel.isLoading && currentItem == nil {
                    VStack(spacing: AppTheme.Metrics.spacingMedium) {
                        SkeletonCardView(lines: 3)
                        SkeletonCardView(lines: 2)
                    }
                    .padding(.horizontal)
                } else if let error = viewModel.errorMessage, currentItem == nil {
                    ErrorRetryView(
                        title: "Gagal Memuat Kelas Pengganti",
                        message: error
                    ) {
                        await viewModel.loadDashboardData()
                    }
                    .padding(.horizontal)
                } else if let kp = liveItem ?? (isItemDeletedOrMissingAfterLoad ? nil : initialItem) {
                    let isCompleted = kp.status.caseInsensitiveCompare("Selesai") == .orderedSame
                    let isInFlight = viewModel.inFlightReplacementIds.contains(kp.id) || isDeleting

                    // 1. Kartu Informasi Utama
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                            Text("Kelas Pengganti")
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.warningBackground)
                                .foregroundStyle(AppTheme.Colors.warning)
                                .clipShape(Capsule())

                            if let kategori = courseCategory, !kategori.isEmpty {
                                Text(kategori)
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.neutralBackground)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                    .clipShape(Capsule())
                            }

                            Spacer()

                            Label(
                                isCompleted ? "Selesai" : "Belum Selesai",
                                systemImage: isCompleted ? "checkmark.circle.fill" : "clock.badge.exclamationmark"
                            )
                            .font(AppTheme.Typography.badge)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(isCompleted ? AppTheme.Colors.successBackground : AppTheme.Colors.infoBackground)
                            .foregroundStyle(isCompleted ? AppTheme.Colors.success : AppTheme.Colors.info)
                            .clipShape(Capsule())
                        }

                        Text(courseTitle)
                            .font(AppTheme.Typography.pageTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        if let dosen = relatedCourse?.dosen, !dosen.isEmpty {
                            HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                                Image(systemName: "person.circle")
                                    .font(.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text(dosen)
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                        }

                        Divider()

                        // Tanggal Pengganti
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "calendar")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandPrimary)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tanggal Pelaksanaan")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text(formattedFullDate(kp.tanggal))
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                            }
                            Spacer()
                        }

                        // Jam Mulai - Selesai
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "clock.fill")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.info)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Waktu Perkuliahan")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text("\(kp.waktuMulai) - \(kp.waktuSelesai)")
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                            }
                            Spacer()
                        }

                        // Lokasi / Ruangan
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandAccent)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Lokasi / Platform")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                if let lokasi = kp.lokasi, !lokasi.isEmpty {
                                    Text(lokasi)
                                        .font(AppTheme.Typography.cardTitle)
                                        .foregroundStyle(AppTheme.Colors.textPrimary)
                                } else {
                                    Text("Belum ditentukan")
                                        .font(AppTheme.Typography.caption)
                                        .foregroundStyle(AppTheme.Colors.textSecondary)
                                }
                            }
                            Spacer()
                        }
                    }
                    .cardSurface()
                    .padding(.horizontal)

                    // 2. Catatan Kelas Pengganti
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        Label("Catatan Kelas Pengganti", systemImage: "note.text")
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.textPrimary)

                        if let note = kp.catatan, !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text(note)
                                .font(AppTheme.Typography.body)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(AppTheme.Metrics.spacingMedium)
                                .background(AppTheme.Colors.warningBackground.opacity(0.6))
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                        } else {
                            Text("Tidak ada catatan tambahan untuk kelas pengganti ini.")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(AppTheme.Metrics.spacingMedium)
                                .background(AppTheme.Colors.neutralBackground.opacity(0.6))
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                        }
                    }
                    .cardSurface()
                    .padding(.horizontal)

                    // 3. Tindakan Penyelesaian, Edit & Hapus
                    VStack(spacing: AppTheme.Metrics.spacingSmall) {
                        if !isCompleted {
                            Button {
                                guard !viewModel.isOffline, !isInFlight else { return }
                                Task {
                                    _ = await viewModel.markReplacementCompletedById(kp.id)
                                }
                            } label: {
                                HStack {
                                    if isInFlight {
                                        ProgressView()
                                            .controlSize(.small)
                                            .tint(.white)
                                    } else {
                                        Image(systemName: "checkmark.circle.fill")
                                    }
                                    Text("Tandai Kelas Pengganti Selesai")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(viewModel.isOffline ? AppTheme.Colors.neutralBackground : AppTheme.Colors.success)
                                .foregroundStyle(viewModel.isOffline ? AppTheme.Colors.textTertiary : Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(viewModel.isOffline || isInFlight)
                        }

                        Button {
                            viewModel.editingReplacement = kp
                            isPresentingEditSheet = true
                        } label: {
                            HStack {
                                Image(systemName: "pencil")
                                Text("Edit Kelas Pengganti")
                                    .fontWeight(.medium)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                            }
                            .padding()
                            .background(AppTheme.Colors.cardBackground)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isOffline || isInFlight)

                        Button(role: .destructive) {
                            isConfirmingDelete = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Hapus Kelas Pengganti")
                                    .fontWeight(.medium)
                                Spacer()
                            }
                            .padding()
                            .background(AppTheme.Colors.urgentBackground)
                            .foregroundStyle(AppTheme.Colors.urgent)
                            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isOffline || isInFlight)
                    }
                    .padding(.horizontal)
                } else {
                    ContentUnavailableView(
                        "Kelas Pengganti Tidak Ditemukan",
                        systemImage: "sparkles",
                        description: Text("Kelas pengganti ini mungkin telah dihapus atau tidak lagi tersedia.")
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.vertical, AppTheme.Metrics.spacingMedium)
        }
        .background(AppTheme.Colors.background)
        .navigationTitle("Detail Kelas Pengganti")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let kp = currentItem {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if kp.status.caseInsensitiveCompare("Selesai") != .orderedSame {
                            Button {
                                Task {
                                    _ = await viewModel.markReplacementCompletedById(kp.id)
                                }
                            } label: {
                                Label("Tandai Selesai", systemImage: "checkmark.circle")
                            }
                            .disabled(viewModel.isOffline)
                        }

                        Button {
                            viewModel.editingReplacement = kp
                            isPresentingEditSheet = true
                        } label: {
                            Label("Edit Kelas Pengganti", systemImage: "pencil")
                        }
                        .disabled(viewModel.isOffline)

                        Button(role: .destructive) {
                            isConfirmingDelete = true
                        } label: {
                            Label("Hapus Kelas Pengganti", systemImage: "trash")
                        }
                        .disabled(viewModel.isOffline)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
                    }
                }
            }
        }
        .sheet(isPresented: $isPresentingEditSheet) {
            KelasPenggantiFormSheet(viewModel: viewModel)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Hapus Kelas Pengganti?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Hapus Permanen", role: .destructive) {
                guard let kp = currentItem else { return }
                isDeleting = true
                Task {
                    let deleted = await viewModel.deleteKelasPengganti(id: kp.id)
                    isDeleting = false
                    if deleted {
                        dismiss()
                    }
                }
            }
            Button("Batal", role: .cancel) {}
        } message: {
            let courseName = courseTitle
            Text("Jadwal kelas pengganti untuk \(courseName) akan dihapus secara permanen.")
        }
        .feedbackToast(toast: $viewModel.toast)
    }
}

