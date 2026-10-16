import SwiftUI

/// Tampilan Detail Tugas native SwiftUI untuk TrackerThings V2.
/// Menampilkan informasi lengkap tugas, relasi mata kuliah, tenggat waktu dengan countdown,
/// pengatur progress interaktif (0-100%), serta aksi Edit dan Hapus permanen dengan konfirmasi.
public struct TaskDetailView: View {
    @Bindable var viewModel: DashboardViewModel
    public let taskId: Int
    public let initialTask: TugasItem?

    @Environment(\.dismiss) private var dismiss
    @State private var localProgress: Double = 0
    @State private var isPresentingEditSheet: Bool = false
    @State private var isConfirmingDelete: Bool = false
    @State private var isDeleting: Bool = false

    public init(
        taskId: Int,
        initialTask: TugasItem? = nil,
        viewModel: DashboardViewModel
    ) {
        self.taskId = taskId
        self.initialTask = initialTask
        self.viewModel = viewModel
        _localProgress = State(initialValue: Double(initialTask?.progress ?? 0))
    }

    private var liveTask: TugasItem? {
        if let urgent = viewModel.urgentTasks.first(where: { $0.id == taskId }) {
            return urgent
        }
        if let completed = viewModel.completedTasks.first(where: { $0.id == taskId }) {
            return completed
        }
        return nil
    }

    private var currentTask: TugasItem? {
        liveTask ?? initialTask
    }

    private var isTaskDeletedOrMissingAfterLoad: Bool {
        !viewModel.isLoading && liveTask == nil && (!viewModel.urgentTasks.isEmpty || !viewModel.completedTasks.isEmpty || !viewModel.courses.isEmpty)
    }

    private var relatedCourse: JadwalItem? {
        guard let task = currentTask else { return nil }
        return viewModel.courses.first(where: { $0.id == task.idJadwal })
    }

    private var courseTitle: String {
        relatedCourse?.namaMatkul ?? currentTask?.jadwal?.namaMatkul ?? "Mata Kuliah Terkait"
    }

    private func priorityColor(for prioritas: TugasItem.PrioritasTugas) -> Color {
        switch prioritas {
        case .tinggi: return AppTheme.Colors.urgent
        case .sedang: return AppTheme.Colors.warning
        case .rendah: return AppTheme.Colors.success
        }
    }

    private func statusColor(for status: TugasItem.StatusTugas) -> Color {
        switch status {
        case .selesai: return AppTheme.Colors.success
        case .sedangDikerjakan: return AppTheme.Colors.info
        case .belumDikerjakan: return AppTheme.Colors.textSecondary
        }
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
                            await viewModel.loadDashboardData()
                        }
                    }
                    .padding(.horizontal)
                }

                if viewModel.isLoading && currentTask == nil {
                    VStack(spacing: AppTheme.Metrics.spacingMedium) {
                        SkeletonCardView(lines: 3)
                        SkeletonCardView(lines: 2)
                    }
                    .padding(.horizontal)
                } else if let error = viewModel.errorMessage, currentTask == nil {
                    ErrorRetryView(
                        title: "Gagal Memuat Detail Tugas",
                        message: error
                    ) {
                        await viewModel.loadDashboardData()
                    }
                    .padding(.horizontal)
                } else if let task = liveTask ?? (isTaskDeletedOrMissingAfterLoad ? nil : initialTask) {
                    let isInFlight = viewModel.inFlightTaskIds.contains(task.id) || isDeleting
                    let diff = daysDifference(to: task.deadline)

                    // 1. Header Ringkasan Tugas
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                            Text(task.prioritas.rawValue)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(priorityColor(for: task.prioritas).opacity(0.14))
                                .foregroundStyle(priorityColor(for: task.prioritas))
                                .clipShape(Capsule())

                            Text(task.jenis.rawValue)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(AppTheme.Colors.neutralBackground)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .clipShape(Capsule())

                            Text(task.status.rawValue)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(statusColor(for: task.status).opacity(0.14))
                                .foregroundStyle(statusColor(for: task.status))
                                .clipShape(Capsule())

                            Spacer()
                        }

                        Text(task.namaTugas)
                            .font(AppTheme.Typography.pageTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)

                        Divider()

                        // Mata Kuliah Terkait
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "book.closed.fill")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandPrimary)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Mata Kuliah")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text(courseTitle)
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                if let dosen = relatedCourse?.dosen, !dosen.isEmpty {
                                    Text(dosen)
                                        .font(AppTheme.Typography.caption)
                                        .foregroundStyle(AppTheme.Colors.textSecondary)
                                }
                            }
                            Spacer()
                        }

                        // Tenggat Waktu
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.subheadline)
                                .foregroundStyle(AppTheme.Colors.brandAccent)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tenggat Waktu")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Text(formattedFullDate(task.deadline))
                                    .font(AppTheme.Typography.cardTitle)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                            }

                            Spacer()

                            if task.status == .selesai {
                                Label("Tuntas", systemImage: "checkmark.seal.fill")
                                    .font(AppTheme.Typography.badge)
                                    .foregroundStyle(AppTheme.Colors.success)
                            } else if diff < 0 {
                                Text("Terlewat \(abs(diff)) hari")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.urgentBackground)
                                    .foregroundStyle(AppTheme.Colors.urgent)
                                    .clipShape(Capsule())
                            } else if diff == 0 {
                                Text("Hari Ini!")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.warningBackground)
                                    .foregroundStyle(AppTheme.Colors.warning)
                                    .clipShape(Capsule())
                            } else {
                                Text("\(diff) hari lagi")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.Colors.infoBackground)
                                    .foregroundStyle(AppTheme.Colors.info)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .cardSurface()
                    .padding(.horizontal)

                    // 2. Pengaturan Progress & Status
                    VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
                        HStack {
                            Label("Progress Pengerjaan", systemImage: "chart.bar.fill")
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)
                            Spacer()
                            if isInFlight {
                                ProgressView()
                                    .controlSize(.small)
                            } else {
                                Text("\(Int(localProgress))%")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(task.status == .selesai ? AppTheme.Colors.success : AppTheme.Colors.brandPrimary)
                            }
                        }

                        Slider(value: $localProgress, in: 0...100, step: 5) {
                            Text("Progress")
                        } onEditingChanged: { isEditing in
                            if !isEditing && !viewModel.isOffline {
                                Task {
                                    await viewModel.updateTaskProgress(task: task, progress: Int(localProgress))
                                }
                            }
                        }
                        .tint(task.status == .selesai ? AppTheme.Colors.success : AppTheme.Colors.brandPrimary)
                        .disabled(viewModel.isOffline || isInFlight)

                        // Quick Preset Progress Buttons
                        HStack(spacing: AppTheme.Metrics.spacingSmall) {
                            ForEach([0, 25, 50, 75, 100], id: \.self) { preset in
                                let isSelected = Int(localProgress) == preset
                                Button {
                                    guard !viewModel.isOffline, !isInFlight else { return }
                                    localProgress = Double(preset)
                                    Task {
                                        await viewModel.updateTaskProgress(task: task, progress: preset)
                                    }
                                } label: {
                                    Text(preset == 100 ? "Selesai" : "\(preset)%")
                                        .font(AppTheme.Typography.captionBold)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(
                                            isSelected
                                                ? AppTheme.Colors.brandPrimary
                                                : AppTheme.Colors.neutralBackground
                                        )
                                        .foregroundStyle(isSelected ? Color.white : AppTheme.Colors.textPrimary)
                                        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .disabled(viewModel.isOffline || isInFlight)
                            }
                        }

                        if task.status != .selesai {
                            Button {
                                guard !viewModel.isOffline, !isInFlight else { return }
                                localProgress = 100
                                Task {
                                    await viewModel.updateTaskProgress(task: task, progress: 100)
                                }
                            } label: {
                                HStack {
                                    Image(systemName: "checkmark.circle.fill")
                                    Text("Tandai Tugas Selesai (100%)")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(viewModel.isOffline ? AppTheme.Colors.neutralBackground : AppTheme.Colors.success)
                                .foregroundStyle(viewModel.isOffline ? AppTheme.Colors.textTertiary : Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(viewModel.isOffline || isInFlight)
                        }
                    }
                    .cardSurface()
                    .padding(.horizontal)

                    // 3. Tindakan Pengelolaan (Edit & Hapus)
                    VStack(spacing: AppTheme.Metrics.spacingSmall) {
                        Button {
                            viewModel.editingTask = task
                            isPresentingEditSheet = true
                        } label: {
                            HStack {
                                Image(systemName: "pencil")
                                Text("Edit Detail Tugas")
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
                                Text("Hapus Tugas")
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
                        "Tugas Tidak Ditemukan",
                        systemImage: "checklist.unchecked",
                        description: Text("Tugas ini mungkin telah dihapus atau tidak lagi tersedia.")
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.vertical, AppTheme.Metrics.spacingMedium)
        }
        .background(AppTheme.Colors.background)
        .navigationTitle("Detail Tugas")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let task = currentTask {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            viewModel.editingTask = task
                            isPresentingEditSheet = true
                        } label: {
                            Label("Edit Tugas", systemImage: "pencil")
                        }
                        .disabled(viewModel.isOffline)

                        Button(role: .destructive) {
                            isConfirmingDelete = true
                        } label: {
                            Label("Hapus Tugas", systemImage: "trash")
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
            TaskFormSheet(viewModel: viewModel)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .confirmationDialog(
            "Hapus Tugas Ini?",
            isPresented: $isConfirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Hapus Permanen", role: .destructive) {
                guard let task = currentTask else { return }
                isDeleting = true
                Task {
                    let deleted = await viewModel.deleteTask(id: task.id)
                    isDeleting = false
                    if deleted {
                        dismiss()
                    }
                }
            }
            Button("Batal", role: .cancel) {}
        } message: {
            Text("Tugas \"\(currentTask?.namaTugas ?? "")\" akan dihapus secara permanen dari server.")
        }
        .onChange(of: liveTask?.progress) { _, newValue in
            if let newValue {
                localProgress = Double(newValue)
            }
        }
        .onAppear {
            if let current = currentTask {
                localProgress = Double(current.progress)
            }
        }
        .feedbackToast(toast: $viewModel.toast)
    }
}

