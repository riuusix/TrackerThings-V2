import SwiftUI

public struct DashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    @State private var courseViewModel: CourseViewModel
    @State private var examViewModel: ExamViewModel
    @State private var isPresentingAddTask = false
    @State private var isPresentingAddReplacement = false

    public init(
        viewModel: DashboardViewModel,
        courseViewModel: CourseViewModel = CourseViewModel(),
        examViewModel: ExamViewModel = ExamViewModel()
    ) {
        self.viewModel = viewModel
        _courseViewModel = State(initialValue: courseViewModel)
        _examViewModel = State(initialValue: examViewModel)
    }

    private var indonesianTodayText: String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "id_ID")
        df.dateFormat = "EEEE, d MMMM yyyy"
        return df.string(from: Date())
    }

    /// Item 'Perlu Perhatian': tugas yang tenggatnya <= 2 hari atau terlewat, dan bukan tugas selesai.
    private var tasksNeedingAttention: [TugasItem] {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        let limit = calendar.date(byAdding: .day, value: 3, to: todayStart) ?? Date()
        return viewModel.urgentTasks.filter { $0.status != .selesai && $0.deadline < limit }
    }

    private var hasAttentionItems: Bool {
        !tasksNeedingAttention.isEmpty || viewModel.upcomingExam != nil
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSection) {
                    // 1. Header & Identitas Pengguna Ringkas + 2. Tanggal Hari Ini
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXXSmall) {
                        HStack(alignment: .center) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(indonesianTodayText)
                                    .font(AppTheme.Typography.captionBold)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                                    .textCase(.uppercase)

                                Text("TrackerThings")
                                    .font(AppTheme.Typography.pageTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                            }

                            Spacer()

                            Text("2026/2027")
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.infoBackground)
                                .foregroundStyle(AppTheme.Colors.info)
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal)

                    // Offline Status Banner
                    if viewModel.isOffline {
                        OfflineBannerView(
                            lastUpdatedText: viewModel.lastCacheDateText
                        ) {
                            Task {
                                await viewModel.loadDashboardData()
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Academic Intelligence Daily Briefing
                    if let summary = viewModel.academicSummary {
                        AcademicBriefingCardView(summary: summary)
                            .padding(.horizontal)
                    }

                    // 3. Jadwal Hari Ini & Day Selector
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack {
                            Label("Jadwal Kuliah: \(viewModel.selectedDay)", systemImage: "calendar.badge.clock")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Text("\(viewModel.schedulesForSelectedDay.count) Kelas")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal)

                        // Compact Day Selector Segment
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(viewModel.daysOfWeek, id: \.self) { day in
                                    let isSelected = viewModel.selectedDay == day
                                    Button {
                                        withAnimation(.snappy) {
                                            viewModel.selectedDay = day
                                        }
                                    } label: {
                                        Text(day)
                                            .font(isSelected ? AppTheme.Typography.captionBold : AppTheme.Typography.caption)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .background(isSelected ? AppTheme.Colors.brandPrimary : AppTheme.Colors.cardBackground)
                                            .foregroundStyle(isSelected ? Color.white : AppTheme.Colors.textPrimary)
                                            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }

                        // Schedule Cards List
                        if viewModel.isLoading && viewModel.courses.isEmpty {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                SkeletonCardView(lines: 2)
                                SkeletonCardView(lines: 2)
                            }
                            .padding(.horizontal)
                        } else if let error = viewModel.errorMessage, viewModel.courses.isEmpty {
                            ErrorRetryView(
                                title: "Gagal Memuat Jadwal",
                                message: error
                            ) {
                                await viewModel.loadDashboardData()
                            }
                            .padding(.vertical, AppTheme.Metrics.spacingSmall)
                        } else if viewModel.schedulesForSelectedDay.isEmpty {
                            ContentUnavailableView(
                                "Tidak Ada Kuliah",
                                systemImage: "sparkles",
                                description: Text("Hari \(viewModel.selectedDay) bebas perkuliahan.")
                            )
                            .padding(.vertical, AppTheme.Metrics.spacingSmall)
                        } else {
                            LazyVStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(viewModel.schedulesForSelectedDay) { schedule in
                                    if schedule.tipe == .pengganti {
                                        let matchingKP = viewModel.replacementClasses.first(where: { $0.id == schedule.id })
                                        NavigationLink {
                                            ReplacementClassDetailView(
                                                replacementId: schedule.id,
                                                initialItem: matchingKP,
                                                viewModel: viewModel
                                            )
                                        } label: {
                                            ScheduleCardView(item: schedule, isOffline: viewModel.isOffline) {
                                                await viewModel.markReplacementCompleted(item: schedule)
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    } else {
                                        let courseId = schedule.idJadwal ?? schedule.id
                                        let matchingCourse = viewModel.courses.first(where: { $0.id == courseId })
                                        NavigationLink {
                                            CourseDetailView(
                                                courseId: courseId,
                                                initialCourse: matchingCourse,
                                                courseViewModel: courseViewModel,
                                                dashboardViewModel: viewModel,
                                                examViewModel: examViewModel
                                            )
                                        } label: {
                                            ScheduleCardView(item: schedule, isOffline: viewModel.isOffline)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 4. Perlu Perhatian (Dedicated Urgency Section)
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Perlu Perhatian", systemImage: "exclamationmark.circle.fill")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(hasAttentionItems ? AppTheme.Colors.urgent : AppTheme.Colors.textPrimary)
                            Spacer()
                            if hasAttentionItems {
                                Text("\(tasksNeedingAttention.count + (viewModel.upcomingExam != nil ? 1 : 0)) Item")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.urgent)
                            }
                        }
                        .padding(.horizontal)

                        if !hasAttentionItems {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(AppTheme.Colors.success)
                                Text("Semua aman! Tidak ada tugas atau ujian mendesak saat ini.")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                            .cardSurface()
                            .padding(.horizontal)
                        } else {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                // Tampilkan tugas yang butuh perhatian
                                ForEach(tasksNeedingAttention) { task in
                                    let matchingInsight = viewModel.prioritizedInsights.first(where: {
                                        $0.itemType == "tugas" && $0.itemId.stringValue == String(task.id)
                                    })
                                    NavigationLink {
                                        TaskDetailView(
                                            taskId: task.id,
                                            initialTask: task,
                                            viewModel: viewModel
                                        )
                                    } label: {
                                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                                            Circle()
                                                .fill(matchingInsight?.priority == "urgent" ? AppTheme.Colors.urgent : AppTheme.Colors.warning)
                                                .frame(width: 8, height: 8)

                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(task.namaTugas)
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                                    .lineLimit(1)
                                                Text("\(task.jadwal?.namaMatkul ?? "Tugas") • Tenggat: \(task.deadline.formatted(date: .abbreviated, time: .omitted))")
                                                    .font(AppTheme.Typography.caption)
                                                    .foregroundStyle(AppTheme.Colors.textSecondary)

                                                if let insight = matchingInsight {
                                                    Text(insight.reason)
                                                        .font(AppTheme.Typography.badge)
                                                        .foregroundStyle(AppTheme.Colors.accent)
                                                        .lineLimit(1)
                                                }
                                            }

                                            Spacer()

                                            Text(matchingInsight?.priority.capitalized ?? task.prioritas.rawValue)
                                                .font(AppTheme.Typography.badge)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(AppTheme.Colors.urgentBackground)
                                                .foregroundStyle(AppTheme.Colors.urgent)
                                                .clipShape(Capsule())
                                        }
                                        .cardSurface(strokeColor: AppTheme.Colors.urgent.opacity(0.3))
                                    }
                                    .buttonStyle(.plain)
                                }

                                // Tampilkan ujian terdekat di section Perlu Perhatian jika ada
                                if let exam = viewModel.upcomingExam {
                                    NavigationLink {
                                        ExamDetailView(
                                            examId: exam.id,
                                            initialExam: exam,
                                            viewModel: examViewModel
                                        )
                                    } label: {
                                        HStack(spacing: AppTheme.Metrics.spacingMedium) {
                                            Image(systemName: "graduationcap.fill")
                                                .font(AppTheme.Typography.captionBold)
                                                .foregroundStyle(AppTheme.Colors.warning)

                                            VStack(alignment: .leading, spacing: 2) {
                                                Text("\(exam.jenisUjian): \(exam.jadwal?.namaMatkul ?? "Ujian Akademik")")
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                                    .lineLimit(1)
                                                Text("\(exam.tanggal.formatted(date: .abbreviated, time: .omitted))\(exam.ruangan.map { " • R: " + $0 } ?? "")")
                                                    .font(AppTheme.Typography.caption)
                                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                            }

                                            Spacer()

                                            Text("Ujian")
                                                .font(AppTheme.Typography.badge)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(AppTheme.Colors.warningBackground)
                                                .foregroundStyle(AppTheme.Colors.warning)
                                                .clipShape(Capsule())
                                        }
                                        .cardSurface(strokeColor: AppTheme.Colors.warning.opacity(0.3))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 5. Tugas & Deadline (Semua Tugas Aktif)
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Daftar Tugas Aktif", systemImage: "checklist")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Text("\(viewModel.urgentTasks.count) Tugas")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal)

                        if viewModel.isLoading && viewModel.urgentTasks.isEmpty && viewModel.courses.isEmpty {
                            VStack(spacing: AppTheme.Metrics.spacingSmall) {
                                SkeletonCardView(lines: 2)
                                SkeletonCardView(lines: 2)
                            }
                            .padding(.horizontal)
                        } else if let error = viewModel.errorMessage, viewModel.urgentTasks.isEmpty && viewModel.courses.isEmpty {
                            ErrorRetryView(
                                title: "Gagal Memuat Tugas",
                                message: error
                            ) {
                                await viewModel.loadDashboardData()
                            }
                            .padding(.vertical, AppTheme.Metrics.spacingSmall)
                        } else if viewModel.urgentTasks.isEmpty {
                            ContentUnavailableView(
                                "Semua Tugas Selesai",
                                systemImage: "checkmark.circle",
                                description: Text("Bagus sekali! Tidak ada tugas yang tertunda.")
                            )
                            .padding(.vertical, AppTheme.Metrics.spacingSmall)
                        } else {
                            LazyVStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(viewModel.urgentTasks) { task in
                                    NavigationLink {
                                        TaskDetailView(
                                            taskId: task.id,
                                            initialTask: task,
                                            viewModel: viewModel
                                        )
                                    } label: {
                                        TaskCardView(
                                            task: task,
                                            isOffline: viewModel.isOffline,
                                            onProgressChanged: { newProg in
                                                Task {
                                                    await viewModel.updateTaskProgress(task: task, progress: newProg)
                                                }
                                            },
                                            onEdit: {
                                                viewModel.editingTask = task
                                                isPresentingAddTask = true
                                            },
                                            onMarkCompleted: {
                                                Task {
                                                    await viewModel.updateTaskProgress(task: task, progress: 100)
                                                }
                                            }
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 6. Kelas Pengganti Terdaftar (Jika Ada)
                    if !viewModel.replacementClasses.isEmpty {
                        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                            HStack {
                                Label("Kelas Pengganti", systemImage: "sparkles")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                Spacer()
                                Text("\(viewModel.replacementClasses.count) Jadwal")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                            .padding(.horizontal)

                            LazyVStack(spacing: AppTheme.Metrics.spacingSmall) {
                                ForEach(viewModel.replacementClasses) { kp in
                                    let isDone = kp.status.caseInsensitiveCompare("Selesai") == .orderedSame
                                    NavigationLink {
                                        ReplacementClassDetailView(
                                            replacementId: kp.id,
                                            initialItem: kp,
                                            viewModel: viewModel
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

                                                    if let kategori = kp.jadwal?.kategori, !kategori.isEmpty {
                                                        Text(kategori)
                                                            .font(AppTheme.Typography.badge)
                                                            .foregroundStyle(AppTheme.Colors.textSecondary)
                                                    }
                                                }

                                                Text(kp.jadwal?.namaMatkul ?? "Kelas Pengganti")
                                                    .font(AppTheme.Typography.cardTitle)
                                                    .foregroundStyle(AppTheme.Colors.textPrimary)

                                                Text("\(kp.tanggal.formatted(date: .abbreviated, time: .omitted)) • \(kp.waktuMulai) - \(kp.waktuSelesai)")
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
                }
                .padding(.vertical, AppTheme.Metrics.spacingMedium)
            }
            .navigationTitle("Home")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            viewModel.editingTask = nil
                            isPresentingAddTask = true
                        } label: {
                            Label("Tambah Tugas", systemImage: "plus.circle")
                        }

                        Button {
                            viewModel.editingReplacement = nil
                            isPresentingAddReplacement = true
                        } label: {
                            Label("Kelas Pengganti", systemImage: "sparkles")
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.headline)
                            .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
                    }
                }
            }
            .refreshable {
                await viewModel.loadDashboardData()
            }
            .task {
                await viewModel.loadDashboardData()
            }
            .sheet(isPresented: $isPresentingAddTask) {
                TaskFormSheet(viewModel: viewModel)
            }
            .sheet(isPresented: $isPresentingAddReplacement) {
                KelasPenggantiFormSheet(viewModel: viewModel)
            }
            .feedbackToast(toast: $viewModel.toast)
        }
    }
}

