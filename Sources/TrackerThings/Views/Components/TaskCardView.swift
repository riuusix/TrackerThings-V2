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
        case .tinggi: return .red
        case .sedang: return .orange
        case .rendah: return .green
        }
    }

    private var daysDifference: Int {
        let calendar = Calendar.current
        let start1 = calendar.startOfDay(for: Date())
        let start2 = calendar.startOfDay(for: task.deadline)
        return calendar.dateComponents([.day], from: start1, to: start2).day ?? 0
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            // Badges & Actions
            HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                Text(task.prioritas.rawValue)
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(priorityColor.opacity(0.12))
                    .foregroundStyle(priorityColor)
                    .clipShape(Capsule())

                Text(task.jenis.rawValue)
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(AppTheme.Colors.neutralBackground)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .clipShape(Capsule())

                if let course = task.jadwal?.namaMatkul {
                    Text(course)
                        .font(AppTheme.Typography.badge)
                        .lineLimit(1)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.infoBackground)
                        .foregroundStyle(AppTheme.Colors.info)
                        .clipShape(Capsule())
                }

                Spacer()

                HStack(spacing: 4) {
                    if task.status != .selesai, let onMarkCompleted = onMarkCompleted {
                        Button {
                            guard !isMarkingComplete, !isOffline else { return }
                            isMarkingComplete = true
                            onMarkCompleted()
                        } label: {
                            if isMarkingComplete {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(AppTheme.Colors.success)
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.body)
                                    .foregroundStyle(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.success)
                            }
                        }
                        .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
                        .disabled(isMarkingComplete || isOffline)
                    }

                    if let onEdit = onEdit {
                        Button(action: onEdit) {
                            Image(systemName: "pencil.circle.fill")
                                .font(.body)
                                .foregroundStyle(AppTheme.Colors.textTertiary)
                        }
                        .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
                        .disabled(isMarkingComplete || isOffline)
                    }
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

            // Progress Slider
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Progress")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                    Spacer()
                    Text("\(Int(localProgress))%")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.info)
                }

                Slider(value: $localProgress, in: 0...100, step: 5) {
                    Text("Progress")
                } onEditingChanged: { isEditing in
                    if !isEditing && !isOffline {
                        onProgressChanged?(Int(localProgress))
                    }
                }
                .tint(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.info)
                .disabled(isOffline)
            }
        }
        .cardSurface()
        .onChange(of: task.progress) { _, newProgress in
            localProgress = Double(newProgress)
            isMarkingComplete = false
        }
    }
}

