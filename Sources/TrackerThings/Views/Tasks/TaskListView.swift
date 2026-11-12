import SwiftUI

/// Tampilan khusus Tab **Tugas** (`AppTab.tasks`) yang menyajikan Tugas Aktif dan Riwayat Tugas Selesai
/// dengan pola **Invisible Pagination** (maksimal 3 tugas per halaman), pencarian, filter prioritas,
/// pengurutan tenggat, serta pelestarian posisi halaman saat kembali dari `TaskDetailView`.
public struct TaskListView: View {
    @Bindable var viewModel: DashboardViewModel
    @State private var isPresentingAddTask = false
    @State private var swipeCoordinator = TaskSwipeCoordinator()
    @Namespace private var filterNamespace

    public init(viewModel: DashboardViewModel) {
        self.viewModel = viewModel
    }

    private let priorityFilters: [String] = ["Semua", "Tinggi", "Sedang", "Rendah"]

    // MARK: - Filtered & Sorted Collections

    private func matchesFilters(_ task: TugasItem) -> Bool {
        // Filter prioritas
        if viewModel.taskListSelectedPriority != "Semua" {
            if task.prioritas.rawValue.caseInsensitiveCompare(viewModel.taskListSelectedPriority) != .orderedSame {
                return false
            }
        }

        // Filter pencarian
        let query = viewModel.taskListSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !query.isEmpty {
            let titleMatch = task.namaTugas.lowercased().contains(query)
            let courseMatch = (task.jadwal?.namaMatkul.lowercased().contains(query) ?? false)
            let descMatch = (task.deskripsi?.lowercased().contains(query) ?? false)
            if !titleMatch && !courseMatch && !descMatch {
                return false
            }
        }

        return true
    }

    private func sortedTasks(_ items: [TugasItem]) -> [TugasItem] {
        items.sorted { a, b in
            if viewModel.taskListSortNewestFirst {
                return a.deadline > b.deadline
            } else {
                return a.deadline < b.deadline
            }
        }
    }

    private var filteredPinnedTasks: [TugasItem] {
        sortedTasks(viewModel.pinnedTasks.filter(matchesFilters))
    }

    private var filteredActiveUnpinnedTasks: [TugasItem] {
        sortedTasks(viewModel.unpinnedUrgentTasks.filter(matchesFilters))
    }

    private var filteredCompletedTasks: [TugasItem] {
        sortedTasks(viewModel.completedTasks.filter(matchesFilters))
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSection) {
                // 1. Header Ringkas + Statistik Tugas
                headerSummaryStrip

                // 2. Banner Undo Penyelesaian Tugas
                if let completedTask = viewModel.recentlyCompletedTask {
                    undoCompletionBanner(for: completedTask)
                }

                // 3. Kontrol Segmen (Tugas Aktif vs Riwayat Selesai) + Filter Prioritas & Urutan
                filterAndSortControls

                // 4. Konten Berdasarkan Segmen Aktif (Maksimal 3 Tugas per Halaman)
                if viewModel.taskListSelectedSegment == 0 {
                    activeTasksContent
                } else {
                    completedHistoryContent
                }
            }
            .padding(.top, AppTheme.Metrics.spacingMedium)
            .padding(.bottom, 120)
        }
        .navigationTitle("Tugas Akademik")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(
            text: $viewModel.taskListSearchText,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Cari nama tugas atau mata kuliah..."
        )
        .onChange(of: viewModel.taskListSearchText) { _, _ in
            viewModel.taskListPinnedPage = 0
            viewModel.taskListActivePage = 0
            viewModel.taskListHistoryPage = 0
        }
        .onChange(of: viewModel.taskListSelectedPriority) { _, _ in
            viewModel.taskListPinnedPage = 0
            viewModel.taskListActivePage = 0
            viewModel.taskListHistoryPage = 0
        }
        .refreshable {
            await viewModel.loadDashboardData()
        }
        .task {
            if viewModel.urgentTasks.isEmpty && viewModel.completedTasks.isEmpty && !viewModel.isLoading {
                await viewModel.loadDashboardData()
            }
        }
        .sheet(isPresented: $isPresentingAddTask) {
            TaskFormSheet(viewModel: viewModel)
        }
        .sheet(item: $viewModel.reminderEditingTask) { reminderTask in
            TaskReminderSheet(task: reminderTask, viewModel: viewModel)
        }
        .feedbackToast(toast: $viewModel.toast)
    }

    // MARK: - Subviews

    private var headerSummaryStrip: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            summaryMetricPill(
                title: "Aktif",
                count: viewModel.urgentTasks.count,
                icon: "checklist",
                tint: AppTheme.Colors.brandPrimary
            )
            summaryMetricPill(
                title: "Disematkan",
                count: viewModel.pinnedTasks.count,
                icon: "pin.fill",
                tint: AppTheme.Colors.warning
            )
            summaryMetricPill(
                title: "Selesai",
                count: viewModel.completedTasks.count,
                icon: "checkmark.seal.fill",
                tint: AppTheme.Colors.success
            )
        }
        .padding(.horizontal)
    }

    private func summaryMetricPill(title: String, count: Int, icon: String, tint: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text("\(count)")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                Text(title)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(AppTheme.Colors.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: AppTheme.Radius.md, style: .continuous)
                .fill(AppTheme.Colors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Radius.md, style: .continuous)
                .strokeBorder(AppTheme.Colors.borderSubtle, lineWidth: 1)
        )
    }

    private func undoCompletionBanner(for completedTask: TugasItem) -> some View {
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
    }

    private var filterAndSortControls: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            // Segmented Picker: Tugas Aktif vs Riwayat Selesai
            Picker("Kategori Tugas", selection: $viewModel.taskListSelectedSegment) {
                Text("Tugas Aktif (\(viewModel.urgentTasks.count))").tag(0)
                Text("Riwayat Selesai (\(viewModel.completedTasks.count))").tag(1)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .accessibilityIdentifier("TaskListView.segmentPicker")

            // Filter Prioritas + Tombol Urutan
            HStack(spacing: AppTheme.Spacing.xs) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(priorityFilters, id: \.self) { priority in
                            let isSelected = (viewModel.taskListSelectedPriority == priority)
                            Button {
                                HapticsHelper.selectionChanged()
                                withAnimation(AppTheme.Motion.interactiveSpring) {
                                    viewModel.taskListSelectedPriority = priority
                                }
                            } label: {
                                Text(priority)
                                    .font(.system(size: 12, weight: isSelected ? .bold : .medium))
                                    .foregroundStyle(isSelected ? Color.white : AppTheme.Colors.textSecondary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background {
                                        if isSelected {
                                            Capsule(style: .continuous)
                                                .fill(AppTheme.Colors.brandPrimary)
                                                .matchedGeometryEffect(id: "TASK_PRIORITY_FILTER_PILL", in: filterNamespace)
                                        } else {
                                            Capsule(style: .continuous)
                                                .fill(AppTheme.Colors.surfacePrimary)
                                                .overlay(
                                                    Capsule(style: .continuous)
                                                        .strokeBorder(AppTheme.Colors.borderSubtle, lineWidth: 1)
                                                )
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.leading)
                }

                Button {
                    HapticsHelper.selectionChanged()
                    withAnimation(AppTheme.Motion.deckPageSpring) {
                        viewModel.taskListSortNewestFirst.toggle()
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.arrow.down")
                            .font(.system(size: 11, weight: .bold))
                        Text(viewModel.taskListSortNewestFirst ? "Terbaru" : "Terdekat")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule(style: .continuous)
                            .fill(AppTheme.Colors.brandPrimary.opacity(0.12))
                    )
                }
                .buttonStyle(.plain)
                .padding(.trailing)
                .accessibilityIdentifier("TaskListView.sortButton")
            }
        }
    }

    @ViewBuilder
    private var activeTasksContent: some View {
        if filteredPinnedTasks.isEmpty && filteredActiveUnpinnedTasks.isEmpty {
            ContentUnavailableView(
                viewModel.taskListSearchText.isEmpty && viewModel.taskListSelectedPriority == "Semua"
                    ? "Semua Tugas Selesai"
                    : "Tidak Ada Tugas yang Cocok",
                systemImage: "checklist.checked",
                description: Text(
                    viewModel.taskListSearchText.isEmpty && viewModel.taskListSelectedPriority == "Semua"
                        ? "Belum ada tugas aktif yang tertunda saat ini."
                        : "Coba ubah kata kunci pencarian atau filter prioritas."
                )
            )
            .padding(.vertical, AppTheme.Spacing.lg)
        } else {
            if !filteredPinnedTasks.isEmpty {
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                    HStack {
                        Label("Disematkan", systemImage: "pin.fill")
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.primary)
                        Spacer()
                        Text("\(filteredPinnedTasks.count) Tugas")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                    .padding(.horizontal)

                    InvisibleTaskPager(
                        items: filteredPinnedTasks,
                        currentPage: $viewModel.taskListPinnedPage,
                        pageSize: 3,
                        sectionAccessibilityId: "TaskList.pinnedTasksPager"
                    ) { task in
                        swipeableTaskRow(for: task)
                    }
                    .padding(.horizontal)
                }
            }

            if !filteredActiveUnpinnedTasks.isEmpty {
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                    HStack {
                        Label("Tugas Aktif", systemImage: "checklist")
                            .font(AppTheme.Typography.sectionHeader)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Spacer()
                        Text("\(filteredActiveUnpinnedTasks.count) Tugas")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                    .padding(.horizontal)

                    InvisibleTaskPager(
                        items: filteredActiveUnpinnedTasks,
                        currentPage: $viewModel.taskListActivePage,
                        pageSize: 3,
                        sectionAccessibilityId: "TaskList.activeTasksPager"
                    ) { task in
                        swipeableTaskRow(for: task)
                    }
                    .padding(.horizontal)
                }
            }
        }
    }

    @ViewBuilder
    private var completedHistoryContent: some View {
        if filteredCompletedTasks.isEmpty {
            ContentUnavailableView(
                viewModel.taskListSearchText.isEmpty && viewModel.taskListSelectedPriority == "Semua"
                    ? "Belum Ada Riwayat Tugas"
                    : "Riwayat Tidak Ditemukan",
                systemImage: "tray",
                description: Text(
                    viewModel.taskListSearchText.isEmpty && viewModel.taskListSelectedPriority == "Semua"
                        ? "Tugas yang telah ditandai selesai (100%) akan tersimpan rapi di sini."
                        : "Tidak ada tugas selesai yang cocok dengan filter saat ini."
                )
            )
            .padding(.vertical, AppTheme.Spacing.lg)
        } else {
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                HStack {
                    Label("Riwayat Tugas Selesai", systemImage: "checkmark.seal.fill")
                        .font(AppTheme.Typography.sectionHeader)
                        .foregroundStyle(AppTheme.Colors.textPrimary)
                    Spacer()
                    Text("\(filteredCompletedTasks.count) Selesai")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
                .padding(.horizontal)

                InvisibleTaskPager(
                    items: filteredCompletedTasks,
                    currentPage: $viewModel.taskListHistoryPage,
                    pageSize: 3,
                    sectionAccessibilityId: "TaskList.historyTasksPager"
                ) { task in
                    swipeableTaskRow(for: task)
                }
                .padding(.horizontal)
            }
        }
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
