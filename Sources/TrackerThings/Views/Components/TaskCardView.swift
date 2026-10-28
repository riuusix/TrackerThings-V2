import SwiftUI

public struct TaskCardView: View {
    public let task: TugasItem
    public var isOffline: Bool = false
    public var onProgressChanged: ((Int) -> Void)?
    public var onEdit: (() -> Void)?
    public var onMarkCompleted: (() -> Void)?

    @State private var localProgress: Double
    @State private var isMarkingComplete: Bool = false

    public init(
        task: TugasItem,
        isOffline: Bool = false,
        onProgressChanged: ((Int) -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onMarkCompleted: (() -> Void)? = nil
    ) {
        self.task = task
        self.isOffline = isOffline
        self.onProgressChanged = onProgressChanged
        self.onEdit = onEdit
        self.onMarkCompleted = onMarkCompleted
        _localProgress = State(initialValue: Double(task.progress))
    }

    private var priorityColor: Color {
        switch task.prioritas {
        case .tinggi: return AppTheme.Colors.urgent
        case .sedang: return AppTheme.Colors.warning
        case .rendah: return AppTheme.Colors.success
        }
    }

    private var daysDifference: Int {
        let calendar = Calendar.current
        let start1 = calendar.startOfDay(for: Date())
        let start2 = calendar.startOfDay(for: task.deadline)
        return calendar.dateComponents([.day], from: start1, to: start2).day ?? 0
    }

    public var body: some View {
        HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
            // Left Circular Completion Toggle
            Button {
                guard !isMarkingComplete, !isOffline, task.status != .selesai else { return }
                isMarkingComplete = true
                onMarkCompleted?()
            } label: {
                if isMarkingComplete {
                    ProgressView()
                        .controlSize(.small)
                        .tint(AppTheme.Colors.success)
                        .frame(width: 24, height: 24)
                } else if task.status == .selesai {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppTheme.Colors.success)
                } else {
                    Circle()
                        .strokeBorder(isOffline ? AppTheme.Colors.borderSubtle : AppTheme.Colors.borderStrong, lineWidth: 1.5)
                        .frame(width: 20, height: 20)
                        .padding(2)
                }
            }
            .buttonStyle(.plain)
            .disabled(isMarkingComplete || isOffline || task.status == .selesai)
            .padding(.top, 2)

            // Main Task Content Area
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                // Header Tags & Actions
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    // Priority Dot + Label
                    HStack(spacing: 4) {
                        Circle()
                            .fill(priorityColor)
                            .frame(width: 6, height: 6)
                        Text(task.prioritas.rawValue)
                            .font(AppTheme.Typography.badge)
                            .foregroundStyle(priorityColor)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2.5)
                    .background(priorityColor.opacity(0.12))
                    .clipShape(Capsule())

                    Text(task.jenis.rawValue)
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2.5)
                        .background(AppTheme.Colors.neutralBackground)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .clipShape(Capsule())

                    if let course = task.jadwal?.namaMatkul {
                        Text(course)
                            .font(AppTheme.Typography.badge)
                            .lineLimit(1)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2.5)
                            .background(AppTheme.Colors.infoBackground)
                            .foregroundStyle(AppTheme.Colors.brandPrimary)
                            .clipShape(Capsule())
                    }

                    Spacer()

                    if let onEdit = onEdit {
                        Button(action: onEdit) {
                            Image(systemName: "pencil")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(AppTheme.Colors.textTertiary)
                        }
                        .frame(width: 28, height: 28)
                        .disabled(isMarkingComplete || isOffline)
                    }
                }

                // Task Name
                Text(task.namaTugas)
                    .font(AppTheme.Typography.cardTitle)
                    .strikethrough(task.status == .selesai)
                    .foregroundStyle(task.status == .selesai ? AppTheme.Colors.textTertiary : AppTheme.Colors.textPrimary)
                    .lineLimit(2)

                // Deadline Info
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    Image(systemName: "calendar")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)

                    Text("Tenggat: \(task.deadline.formatted(date: .abbreviated, time: .omitted))")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .monospacedDigit()

                    if task.status != .selesai {
                        if daysDifference < 0 {
                            Text("Terlewat")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(AppTheme.Colors.urgent)
                        } else if daysDifference == 0 {
                            Text("Hari Ini!")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(AppTheme.Colors.warning)
                        } else if daysDifference == 1 {
                            Text("Besok")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(AppTheme.Colors.warning)
                        }
                    }
                }

                // Tabular Progress Rail
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text("Progress")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textTertiary)
                        Spacer()
                        Text("\(Int(localProgress))%")
                            .font(AppTheme.Typography.captionBold)
                            .foregroundStyle(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.brandPrimary)
                            .monospacedDigit()
                    }

                    Slider(value: $localProgress, in: 0...100, step: 5) {
                        Text("Progress")
                    } onEditingChanged: { isEditing in
                        if !isEditing && !isOffline {
                            onProgressChanged?(Int(localProgress))
                        }
                    }
                    .tint(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.brandPrimary)
                    .disabled(isOffline || task.status == .selesai)
                }
            }
        }
        .cardSurface(strokeColor: AppTheme.Colors.borderSubtle, strokeWidth: 1)
        .onChange(of: task.progress) { _, newProgress in
            localProgress = Double(newProgress)
            isMarkingComplete = false
        }
    }
}

