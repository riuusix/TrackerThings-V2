import SwiftUI

/// Tampilan Detail Mata Kuliah native SwiftUI untuk TrackerThings V2.
/// Menampilkan informasi jadwal kuliah reguler, serta seluruh entitas berelasi (Tugas, Ujian, dan Kelas Pengganti)
/// yang terhubung ke mata kuliah ini, lengkap dengan navigasi ke halaman detail dan aksi CRUD kontekstual.
public struct CourseDetailView: View {
    @Bindable var courseViewModel: CourseViewModel
    @Bindable var dashboardViewModel: DashboardViewModel
    @Bindable var examViewModel: ExamViewModel
    public let courseId: Int
    public let initialCourse: JadwalItem?

    @Environment(\.dismiss) private var dismiss
    @State private var isPresentingEditCourseSheet: Bool = false
    @State private var isPresentingAddTaskSheet: Bool = false
    @State private var isPresentingAddExamSheet: Bool = false
    @State private var isPresentingAddReplacementSheet: Bool = false
    @State private var isConfirmingDeleteCourse: Bool = false

    public init(
        courseId: Int,
        initialCourse: JadwalItem? = nil,
        courseViewModel: CourseViewModel,
        dashboardViewModel: DashboardViewModel,
        examViewModel: ExamViewModel
    ) {
        self.courseId = courseId
        self.initialCourse = initialCourse
        self.courseViewModel = courseViewModel
        self.dashboardViewModel = dashboardViewModel
        self.examViewModel = examViewModel
    }

    private var liveCourse: JadwalItem? {
        courseViewModel.courses.first(where: { $0.id == courseId })
            ?? dashboardViewModel.courses.first(where: { $0.id == courseId })
    }

    private var currentCourse: JadwalItem? {
        liveCourse ?? initialCourse
    }

    private var isCourseDeletedOrMissingAfterLoad: Bool {
        !courseViewModel.isLoading && liveCourse == nil && !courseViewModel.courses.isEmpty
    }

    private var relatedTasks: [TugasItem] {
        let active = dashboardViewModel.urgentTasks.filter { $0.idJadwal == courseId }
        let completed = dashboardViewModel.completedTasks.filter { $0.idJadwal == courseId }
        return active + completed
    }

    private var relatedExams: [UjianItem] {
        let source = !examViewModel.exams.isEmpty ? examViewModel.exams : dashboardViewModel.allExams
        return source
            .filter { $0.idJadwal == courseId }
            .sorted { $0.tanggal < $1.tanggal }
    }

    private var relatedReplacements: [KelasPenggantiItem] {
        dashboardViewModel.replacementClasses
            .filter { $0.idJadwal == courseId }
            .sorted { $0.tanggal > $1.tanggal }
    }

    private func priorityColor(for prioritas: TugasItem.PrioritasTugas) -> Color {
        switch prioritas {
        case .tinggi: return AppTheme.Colors.urgent
        case .sedang: return AppTheme.Colors.warning
        case .rendah: return AppTheme.Colors.success
        }
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSection) {
                if courseViewModel.isOffline {
                    OfflineBannerView(lastUpdatedText: courseViewModel.lastCacheDateText) {
                        Task {
                            await refreshAllRelatedData()
                        }
                    }
                    .padding(.horizontal)
                }

                if (courseViewModel.isLoading || dashboardViewModel.isLoading) && currentCourse == nil {
                    VStack(spacing: AppTheme.Metrics.spacingMedium) {
                        SkeletonCardView(lines: 3)
                        SkeletonCardView(lines: 2)
                        SkeletonCardView(lines: 2)
                    }
                    .padding(.horizontal)
                } else if let error = courseViewModel.errorMessage, currentCourse == nil {
                    ErrorRetryView(
                        title: "Gagal Memuat Detail Mata Kuliah",
                        message: error
                    ) {
                        await refreshAllRelatedData()
                    }
                    .padding(.horizontal)
                } else if let course = liveCourse ?? (isCourseDeletedOrMissingAfterLoad ? nil : initialCourse) {
                    let isDeleting = courseViewModel.deletingId == course.id

                    // 1. Kartu Informasi Mata Kuliah
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                            Text(course.hari)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.infoBackground)
                                .foregroundStyle(AppTheme.Colors.brandPrimary)
                                .clipShape(Capsule())

                            if let kategori = course.kategori, !kategori.isEmpty {
                                Text(kategori)
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.neutralBackground)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                    .clipShape(Capsule())
                            }

                            Spacer()
                        }

                        Text(course.namaMatkul)
                            .font(AppTheme.Typography.pageTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        Divider()

                        // Jadwal Jam Reguler
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "clock.fill")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandPrimary)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Waktu Perkuliahan")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text("\(course.hari), \(course.waktuMulai) - \(course.waktuSelesai)")
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
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
                                if let lokasi = course.lokasi, !lokasi.isEmpty {
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

                        // Dosen Pengampu
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "person.fill")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.info)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Dosen Pengampu")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                if let dosen = course.dosen, !dosen.isEmpty {
                                    Text(dosen)
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

                    // 2. Bagian Tugas Terkait
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Tugas Kuliah (\(relatedTasks.count))", systemImage: "checklist")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Button {
                                dashboardViewModel.editingTask = nil
                                isPresentingAddTaskSheet = true
                            } label: {
                                Label("Tambah", systemImage: "plus.circle.fill")
                                    .font(AppTheme.Typography.captionBold)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                            }
                            .disabled(courseViewModel.isOffline)
                        }
                        .padding(.horizontal)

                        if relatedTasks.isEmpty {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                Image(systemName: "tray")
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text("Belum ada tugas untuk mata kuliah ini.")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                Spacer()
                            }
                            .cardSurface()
                            .padding(.horizontal)
                        } else {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(relatedTasks) { task in
                                    NavigationLink {
                                        TaskDetailView(
                                            taskId: task.id,
                                            initialTask: task,
                                            viewModel: dashboardViewModel
                                        )
                                    } label: {
                                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                HStack(spacing: 6) {
                                                    Text(task.prioritas.rawValue)
                                                        .font(AppTheme.Typography.badge)
                                                        .padding(.horizontal, 6)
                                                        .padding(.vertical, 2)
                                                        .background(priorityColor(for: task.prioritas).opacity(0.14))
                                                        .foregroundStyle(priorityColor(for: task.prioritas))
                                                        .clipShape(Capsule())

                                                    Text(task.status.rawValue)
                                                        .font(AppTheme.Typography.badge)
                                                        .foregroundStyle(AppTheme.Colors.textSecondary)
                                                }

                                                Text(task.namaTugas)
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                                    .strikethrough(task.status == .selesai)
                                                    .multilineTextAlignment(.leading)

                                                Text("Tenggat: \(task.deadline.formatted(date: .abbreviated, time: .omitted)) • \(task.progress)%")
                                                    .font(AppTheme.Typography.caption)
                                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                            }

                                            Spacer()

                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(AppTheme.Colors.textTertiary)
                                        }
                                        .cardSurface()
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 3. Bagian Ujian Terkait
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Jadwal Ujian (\(relatedExams.count))", systemImage: "graduationcap.fill")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Button {
                                examViewModel.editingExam = nil
                                isPresentingAddExamSheet = true
                            } label: {
                                Label("Tambah", systemImage: "plus.circle.fill")
                                    .font(AppTheme.Typography.captionBold)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                            }
                            .disabled(courseViewModel.isOffline)
                        }
                        .padding(.horizontal)

                        if relatedExams.isEmpty {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                Image(systemName: "graduationcap")
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text("Belum ada jadwal ujian untuk mata kuliah ini.")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                Spacer()
                            }
                            .cardSurface()
                            .padding(.horizontal)
                        } else {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(relatedExams) { exam in
                                    NavigationLink {
                                        ExamDetailView(
                                            examId: exam.id,
                                            initialExam: exam,
                                            viewModel: examViewModel
                                        )
                                    } label: {
                                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(exam.jenisUjian)
                                                    .font(AppTheme.Typography.badge)
                                                    .padding(.horizontal, 6)
                                                    .padding(.vertical, 2)
                                                    .background(AppTheme.Colors.urgentBackground)
                                                    .foregroundStyle(AppTheme.Colors.urgent)
                                                    .clipShape(Capsule())

                                                Text(exam.tanggal.formatted(date: .abbreviated, time: .omitted))
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)

                                                HStack(spacing: 8) {
                                                    if let start = exam.waktuMulai, !start.isEmpty {
                                                        Text("\(start)\(exam.waktuSelesai.map { " - " + $0 } ?? "")")
                                                    }
                                                    if let room = exam.ruangan, !room.isEmpty {
                                                        Text("• \(room)")
                                                    }
                                                }
                                                .font(AppTheme.Typography.caption)
                                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                            }

                                            Spacer()

                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(AppTheme.Colors.textTertiary)
                                        }
                                        .cardSurface()
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 4. Bagian Kelas Pengganti Terkait
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Kelas Pengganti (\(relatedReplacements.count))", systemImage: "sparkles")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Button {
                                dashboardViewModel.editingReplacement = nil
                                isPresentingAddReplacementSheet = true
                            } label: {
                                Label("Tambah", systemImage: "plus.circle.fill")
                                    .font(AppTheme.Typography.captionBold)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                            }
                            .disabled(courseViewModel.isOffline)
                        }
                        .padding(.horizontal)

                        if relatedReplacements.isEmpty {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                Image(systemName: "calendar.badge.plus")
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text("Belum ada jadwal kelas pengganti.")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                Spacer()
                            }
                            .cardSurface()
                            .padding(.horizontal)
                        } else {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(relatedReplacements) { kp in
                                    let isDone = kp.status.caseInsensitiveCompare("Selesai") == .orderedSame
                                    NavigationLink {
                                        ReplacementClassDetailView(
                                            replacementId: kp.id,
                                            initialItem: kp,
                                            viewModel: dashboardViewModel
                                        )
                                    } label: {
                                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                                            VStack(alignment: .leading, spacing: 4) {
                                                HStack(spacing: 6) {
                                                    Text(isDone ? "Selesai" : "Belum Selesai")
                                                        .font(AppTheme.Typography.badge)
                                                        .padding(.horizontal, 6)
                                                        .padding(.vertical, 2)
                                                        .background(isDone ? AppTheme.Colors.successBackground : AppTheme.Colors.warningBackground)
                                                        .foregroundStyle(isDone ? AppTheme.Colors.success : AppTheme.Colors.warning)
                                                        .clipShape(Capsule())
                                                }

                                                Text("\(kp.tanggal.formatted(date: .abbreviated, time: .omitted)) • \(kp.waktuMulai) - \(kp.waktuSelesai)")
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)

                                                if let lokasi = kp.lokasi, !lokasi.isEmpty {
                                                    Text("Lokasi: \(lokasi)")
                                                        .font(AppTheme.Typography.caption)
                                                        .foregroundStyle(AppTheme.Colors.textSecondary)
                                                }
                                            }

                                            Spacer()

                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(AppTheme.Colors.textTertiary)
                                        }
                                        .cardSurface()
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 5. Tindakan Pengelolaan Mata Kuliah
                    VStack(spacing: AppTheme.Metrics.spacingSmall) {
                        Button {
                            courseViewModel.editingCourse = course
                            isPresentingEditCourseSheet = true
                        } label: {
                            HStack {
                                Image(systemName: "pencil")
                                Text("Edit Informasi Mata Kuliah")
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
                        .disabled(courseViewModel.isOffline || isDeleting)

                        Button(role: .destructive) {
                            isConfirmingDeleteCourse = true
                        } label: {
                            HStack {
                                Image(systemName: "trash")
                                Text("Hapus Mata Kuliah")
                                    .fontWeight(.medium)
                                Spacer()
                            }
                            .padding()
                            .background(AppTheme.Colors.urgentBackground)
                            .foregroundStyle(AppTheme.Colors.urgent)
                            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(courseViewModel.isOffline || isDeleting)
                    }
                    .padding(.horizontal)
                } else {
                    ContentUnavailableView(
                        "Mata Kuliah Tidak Ditemukan",
                        systemImage: "book.closed",
                        description: Text("Mata kuliah ini mungkin telah dihapus atau tidak lagi tersedia.")
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.vertical, AppTheme.Metrics.spacingMedium)
        }
        .background(AppTheme.Colors.background)
        .navigationTitle("Detail Mata Kuliah")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let course = currentCourse {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            courseViewModel.editingCourse = course
                            isPresentingEditCourseSheet = true
                        } label: {
                            Label("Edit Mata Kuliah", systemImage: "pencil")
                        }
                        .disabled(courseViewModel.isOffline)

                        Divider()

                        Button {
                            dashboardViewModel.editingTask = nil
                            isPresentingAddTaskSheet = true
                        } label: {
                            Label("Tambah Tugas Kuliah", systemImage: "checklist")
                        }
                        .disabled(courseViewModel.isOffline)

                        Button {
                            examViewModel.editingExam = nil
                            isPresentingAddExamSheet = true
                        } label: {
                            Label("Tambah Jadwal Ujian", systemImage: "graduationcap")
                        }
                        .disabled(courseViewModel.isOffline)

                        Button {
                            dashboardViewModel.editingReplacement = nil
                            isPresentingAddReplacementSheet = true
                        } label: {
                            Label("Tambah Kelas Pengganti", systemImage: "sparkles")
                        }
                        .disabled(courseViewModel.isOffline)

                        Divider()

                        Button(role: .destructive) {
                            isConfirmingDeleteCourse = true
                        } label: {
                            Label("Hapus Mata Kuliah", systemImage: "trash")
                        }
                        .disabled(courseViewModel.isOffline)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
                    }
                }
            }
        }
        .sheet(isPresented: $isPresentingEditCourseSheet, onDismiss: {
            Task {
                await dashboardViewModel.loadDashboardData()
            }
        }) {
            CourseFormSheet(viewModel: courseViewModel)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isPresentingAddTaskSheet) {
            TaskFormSheet(viewModel: dashboardViewModel, defaultCourseId: courseId)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isPresentingAddExamSheet, onDismiss: {
            Task {
                await dashboardViewModel.loadDashboardData()
            }
        }) {
            ExamFormSheet(viewModel: examViewModel, defaultCourseId: courseId)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $isPresentingAddReplacementSheet) {
            KelasPenggantiFormSheet(viewModel: dashboardViewModel, defaultCourseId: courseId)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Hapus Mata Kuliah?",
            isPresented: $isConfirmingDeleteCourse,
            titleVisibility: .visible
        ) {
            Button("Hapus Permanen", role: .destructive) {
                guard let course = currentCourse else { return }
                Task {
                    let deleted = await courseViewModel.deleteCourse(id: course.id)
                    if deleted {
                        await dashboardViewModel.loadDashboardData()
                        dismiss()
                    }
                }
            }
            Button("Batal", role: .cancel) {}
        } message: {
            Text("Mata kuliah \"\(currentCourse?.namaMatkul ?? "")\" beserta seluruh tugas, ujian, dan kelas pengganti terkait akan dihapus secara permanen.")
        }
        .refreshable {
            await refreshAllRelatedData()
        }
        .task {
            if dashboardViewModel.courses.isEmpty {
                await dashboardViewModel.loadDashboardData()
            }
            if examViewModel.exams.isEmpty {
                await examViewModel.fetchExams()
            }
        }
        .feedbackToast(toast: $courseViewModel.toast)
    }

    private func refreshAllRelatedData() async {
        async let refreshCourses: () = courseViewModel.fetchCourses()
        async let refreshDashboard: () = dashboardViewModel.loadDashboardData()
        async let refreshExams: () = examViewModel.fetchExams()
        _ = await (refreshCourses, refreshDashboard, refreshExams)
    }
}

