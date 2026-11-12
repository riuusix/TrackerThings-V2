import SwiftUI

public struct DashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    @State private var courseViewModel: CourseViewModel
    @State private var examViewModel: ExamViewModel
    var dockController: QuickActionDockController?
    @State private var isPresentingAddTask = false
    @State private var isPresentingAddReplacement = false
    @State private var swipeCoordinator = TaskSwipeCoordinator()
    @Namespace private var dayNamespace

    public init(
        viewModel: DashboardViewModel,
        courseViewModel: CourseViewModel = CourseViewModel(),
        examViewModel: ExamViewModel = ExamViewModel(),
        dockController: QuickActionDockController? = nil
    ) {
        self.viewModel = viewModel
        _courseViewModel = State(initialValue: courseViewModel)
        _examViewModel = State(initialValue: examViewModel)
        self.dockController = dockController
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

                            HStack(spacing: 8) {
                                Text("2026/2027")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(AppTheme.Colors.infoBackground)
                                    .foregroundStyle(AppTheme.Colors.info)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)

                    // Inline Task Completion Undo Banner
                    if let completedTask = viewModel.recentlyCompletedTask {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AppTheme.Colors.success)

                            VStack(alignment: .leading, spacing: 1) {
                                Text("Tugas diselesaikan")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                Text(completedTask.namaTugas)
                                    .font(.caption2)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                    .lineLimit(1)
                            }

                            Spacer()

                            Button {
                                Task {
                                    await viewModel.undoRecentTaskCompletion()
                                }
                            } label: {
                                Text("Urungkan")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.Colors.primary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(AppTheme.Colors.primaryMuted)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(AppTheme.Colors.secondarySurface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(AppTheme.Colors.success.opacity(0.35), lineWidth: 1)
                        )
                        .padding(.horizontal)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

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
                                        HapticsHelper.selection()
                                        withAnimation(AppTheme.Motion.interactiveSpring) {
                                            viewModel.selectedDay = day
                                        }
                                    } label: {
                                        Text(day)
                                            .font(isSelected ? AppTheme.Typography.captionBold : AppTheme.Typography.caption)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .foregroundStyle(isSelected ? Color.white : AppTheme.Colors.textPrimary)
                                            .background {
                                                if isSelected {
                                                    RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous)
                                                        .fill(AppTheme.Colors.brandPrimary)
                                                        .matchedGeometryEffect(id: "DAY_SELECTOR_PILL", in: dayNamespace)
                                                } else {
                                                    RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous)
                                                        .fill(AppTheme.Colors.cardBackground)
                                                }
                                            }
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

                    // 5. Tugas Disematkan (Jika Ada — Tidak Pernah Terduplikasi di Daftar Tugas Aktif)
                    if !viewModel.pinnedTasks.isEmpty {
                        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                            HStack {
                                Label("Disematkan", systemImage: "pin.fill")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.primary)
                                Spacer()
                                Text("\(viewModel.pinnedTasks.count) Tugas")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                            .padding(.horizontal)

                            InvisibleTaskPager(
                                items: viewModel.pinnedTasks,
                                currentPage: $viewModel.dashboardPinnedPage,
                                pageSize: 3,
                                sectionAccessibilityId: "Dashboard.pinnedTasksPager"
                            ) { task in
                                swipeableTaskRow(for: task)
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 6. Tugas & Deadline (Tugas Aktif yang Tidak Disematkan — Maksimal 3 per Halaman)
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                        HStack {
                            Label("Daftar Tugas Aktif", systemImage: "checklist")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            Text("\(viewModel.unpinnedUrgentTasks.count) Tugas")
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
                        } else if viewModel.unpinnedUrgentTasks.isEmpty {
                            HStack(spacing: AppTheme.Metrics.spacingSmall) {
                                Image(systemName: "pin.circle.fill")
                                    .foregroundStyle(AppTheme.Colors.primary)
                                Text("Seluruh tugas aktif saat ini berada pada bagian Disematkan di atas.")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            }
                            .cardSurface()
                            .padding(.horizontal)
                        } else {
                            InvisibleTaskPager(
                                items: viewModel.unpinnedUrgentTasks,
                                currentPage: $viewModel.dashboardActivePage,
                                pageSize: 3,
                                sectionAccessibilityId: "Dashboard.activeTasksPager"
                            ) { task in
                                swipeableTaskRow(for: task)
                            }
                            .padding(.horizontal)
                        }
                    }

                    // 6b. Riwayat Tugas Selesai Ringkas (Invisible Pagination — Maksimal 3 per Halaman)
                    if !viewModel.completedTasks.isEmpty {
                        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                            HStack {
                                Label("Riwayat Selesai", systemImage: "checkmark.seal.fill")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                Spacer()
                                Button {
                                    HapticsHelper.selectionChanged()
                                    viewModel.taskListSelectedSegment = 1
                                    AppNavigationCoordinator.shared.selectedTab = .tasks
                                } label: {
                                    HStack(spacing: 4) {
                                        Text("Semua (\(viewModel.completedTasks.count))")
                                        Image(systemName: "arrow.up.right")
                                    }
                                    .font(AppTheme.Typography.captionBold)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal)

                            InvisibleTaskPager(
                                items: viewModel.completedTasks,
                                currentPage: $viewModel.dashboardCompletedPage,
                                pageSize: 3,
                                sectionAccessibilityId: "Dashboard.completedTasksPager"
                            ) { task in
                                swipeableTaskRow(for: task)
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
                .padding(.top, AppTheme.Metrics.spacingMedium)
                .padding(.bottom, 120)
            }
            .navigationTitle("Beranda")
            .navigationBarTitleDisplayMode(.inline)
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
            .sheet(item: $viewModel.reminderEditingTask) { reminderTask in
                TaskReminderSheet(task: reminderTask, viewModel: viewModel)
            }
            .feedbackToast(toast: $viewModel.toast)
    }

    @ViewBuilder
    private func swipeableTaskRow(for task: TugasItem) -> some View {
        SwipeableTaskRow(
            task: task,
            isOffline: viewModel.isOffline,
            coordinator: swipeCoordinator,
            onTapRow: {
                AppNavigationCoordinator.shared.navigate(to: .taskDetail(id: task.id))
            },
            onTogglePin: {
                Task {
                    await viewModel.toggleTaskPin(task: task)
                }
            },
            onOpenReminder: {
                viewModel.reminderEditingTask = task
            }
        ) {
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
                },
                onConfigureReminder: {
                    viewModel.reminderEditingTask = task
                }
            )
        }
    }
}

