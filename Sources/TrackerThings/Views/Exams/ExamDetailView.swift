import SwiftUI

/// Tampilan Detail Ujian native SwiftUI untuk TrackerThings V2.
/// Menampilkan jenis evaluasi, hitung mundur hari, mata kuliah terkait, waktu, ruangan, catatan materi,
/// serta aksi Edit dan Hapus permanen dengan konfirmasi.
public struct ExamDetailView: View {
    @Bindable var viewModel: ExamViewModel
    public let examId: Int
    public let initialExam: UjianItem?

    @Environment(\.dismiss) private var dismiss
    @State private var isPresentingEditSheet: Bool = false
    @State private var isConfirmingDelete: Bool = false

    public init(
        examId: Int,
        initialExam: UjianItem? = nil,
        viewModel: ExamViewModel
    ) {
        self.examId = examId
        self.initialExam = initialExam
        self.viewModel = viewModel
    }

    private var liveExam: UjianItem? {
        viewModel.exams.first(where: { $0.id == examId })
    }

    private var currentExam: UjianItem? {
        liveExam ?? initialExam
    }

    private var isExamDeletedOrMissingAfterLoad: Bool {
        !viewModel.isLoading && liveExam == nil && !viewModel.exams.isEmpty
    }

    private var relatedCourse: JadwalItem? {
        guard let exam = currentExam else { return nil }
        return viewModel.courses.first(where: { $0.id == exam.idJadwal })
    }

    private var courseTitle: String {
        relatedCourse?.namaMatkul ?? currentExam?.jadwal?.namaMatkul ?? "Ujian Akademik"
    }

    private var courseCategory: String? {
        relatedCourse?.kategori
    }

    private func daysDifference(to target: Date) -> Int {
        let calendar = Calendar.current
        let start1 = calendar.startOfDay(for: Date())
        let start2 = calendar.startOfDay(for: target)
        return calendar.dateComponents([.day], from: start1, to: start2).day ?? 0
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
                            await viewModel.fetchExams()
                        }
                    }
                    .padding(.horizontal)
                }

                if viewModel.isLoading && currentExam == nil {
                    VStack(spacing: AppTheme.Metrics.spacingMedium) {
                        SkeletonCardView(lines: 3)
                        SkeletonCardView(lines: 2)
                    }
                    .padding(.horizontal)
                } else if let error = viewModel.errorMessage, currentExam == nil {
                    ErrorRetryView(
                        title: "Gagal Memuat Detail Ujian",
                        message: error
                    ) {
                        await viewModel.fetchExams()
                    }
                    .padding(.horizontal)
                } else if let exam = liveExam ?? (isExamDeletedOrMissingAfterLoad ? nil : initialExam) {
                    let isDeleting = viewModel.deletingId == exam.id
                    let diff = daysDifference(to: exam.tanggal)

                    // 1. Kartu Utama Ujian
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack {
                            Text(exam.jenisUjian)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.urgentBackground)
                                .foregroundStyle(AppTheme.Colors.urgent)
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

                            if diff < 0 {
                                Text("Selesai")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.neutralBackground)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                    .clipShape(Capsule())
                            } else if diff == 0 {
                                Text("Hari Ini!")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.urgentBackground)
                                    .foregroundStyle(AppTheme.Colors.urgent)
                                    .clipShape(Capsule())
                            } else {
                                Text("\(diff) hari lagi")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.warningBackground)
                                    .foregroundStyle(AppTheme.Colors.warning)
                                    .clipShape(Capsule())
                            }
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

                        // Tanggal Pelaksanaan
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "calendar")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandPrimary)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tanggal Pelaksanaan")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text(formattedFullDate(exam.tanggal))
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                            }
                            Spacer()
                        }

                        // Waktu Pelaksanaan
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "clock.fill")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.info)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Waktu Ujian")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                if let start = exam.waktuMulai, !start.isEmpty {
                                    Text("\(start)\(exam.waktuSelesai.map { " - " + $0 } ?? "")")
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

                        // Ruangan / Lokasi
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandAccent)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Ruangan / Lokasi")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                if let room = exam.ruangan, !room.isEmpty {
                                    Text(room)
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

                    // 2. Catatan & Materi Ujian
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        Label("Materi & Catatan Ujian", systemImage: "doc.text.fill")
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.textPrimary)

                        if let note = exam.catatan, !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text(note)
                                .font(AppTheme.Typography.body)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(AppTheme.Metrics.spacingMedium)
                                .background(AppTheme.Colors.neutralBackground)
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                        } else {
                            Text("Belum ada catatan materi atau ketentuan khusus untuk ujian ini.")
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

                    // 3. Tindakan Pengelolaan (Edit & Hapus)
                    VStack(spacing: AppTheme.Metrics.spacingSmall) {
                        Button {
                            viewModel.editingExam = exam
                            isPresentingEditSheet = true
                        } label: {
                            HStack {
                                Image(systemName: "pencil")
                                Text("Edit Jadwal Ujian")
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
                        .disabled(viewModel.isOffline || isDeleting)

                        Button(role: .destructive) {
                            isConfirmingDelete = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Hapus Jadwal Ujian")
                                    .fontWeight(.medium)
                                Spacer()
                            }
                            .padding()
                            .background(AppTheme.Colors.urgentBackground)
                            .foregroundStyle(AppTheme.Colors.urgent)
                            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isOffline || isDeleting)
                    }
                    .padding(.horizontal)
                } else {
                    ContentUnavailableView(
                        "Jadwal Ujian Tidak Ditemukan",
                        systemImage: "graduationcap",
                        description: Text("Jadwal ujian ini mungkin telah dihapus atau tidak lagi tersedia.")
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.vertical, AppTheme.Metrics.spacingMedium)
        }
        .background(AppTheme.Colors.background)
        .navigationTitle("Detail Ujian")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let exam = currentExam {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            viewModel.editingExam = exam
                            isPresentingEditSheet = true
                        } label: {
                            Label("Edit Ujian", systemImage: "pencil")
                        }
                        .disabled(viewModel.isOffline)

                        Button(role: .destructive) {
                            isConfirmingDelete = true
                        } label: {
                            Label("Hapus Ujian", systemImage: "trash")
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
            ExamFormSheet(viewModel: viewModel)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Hapus Jadwal Ujian?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Hapus Permanen", role: .destructive) {
                guard let exam = currentExam else { return }
                Task {
                    let deleted = await viewModel.deleteExam(id: exam.id)
                    if deleted {
                        dismiss()
                    }
                }
            }
            Button("Batal", role: .cancel) {}
        } message: {
            let courseName = courseTitle
            Text("Jadwal \(currentExam?.jenisUjian ?? "Ujian") untuk \(courseName) akan dihapus secara permanen.")
        }
        .task {
            if viewModel.exams.isEmpty {
                await viewModel.fetchExams()
            }
        }
        .feedbackToast(toast: $viewModel.toast)
    }
}

