import SwiftUI

/// Signature Interaction 04 — Living Academic Task Component.
/// Menggabungkan cincin penyelesaian taktil (dengan busur progres melingkar), indikator urgensi editorial,
/// serta laci kontrol progres inline yang dapat diperluas (`isExpanded`) agar kartu tetap bersih secara default
/// namun memberikan kontrol penuh saat dibutuhkan.
public struct TaskCardView: View {
    public let task: TugasItem
    public var isOffline: Bool = false
    public var onProgressChanged: ((Int) -> Void)?
    public var onEdit: (() -> Void)?
    public var onMarkCompleted: (() -> Void)?
    public var onConfigureReminder: (() -> Void)?

    @State private var localProgress: Double
    @State private var isMarkingComplete: Bool = false
    @State private var isExpanded: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        task: TugasItem,
        isOffline: Bool = false,
        onProgressChanged: ((Int) -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onMarkCompleted: (() -> Void)? = nil,
        onConfigureReminder: (() -> Void)? = nil
    ) {
        self.task = task
        self.isOffline = isOffline
        self.onProgressChanged = onProgressChanged
        self.onEdit = onEdit
        self.onMarkCompleted = onMarkCompleted
        self.onConfigureReminder = onConfigureReminder
        _localProgress = State(initialValue: Double(task.progress))
    }

    private var priorityColor: Color {
        switch task.prioritas {
        case .tinggi: return AppTheme.Colors.urgent
        case .sedang: return AppTheme.Colors.warning
        case .rendah: return AppTheme.Colors.success
        }
    }

    private var courseAccent: Color {
        AppTheme.Colors.courseAccent(for: task.jadwal?.namaMatkul)
    }

    private var daysDifference: Int {
        let calendar = Calendar.current
        let start1 = calendar.startOfDay(for: Date())
        let start2 = calendar.startOfDay(for: task.deadline)
        return calendar.dateComponents([.day], from: start1, to: start2).day ?? 0
    }

    private let quickSteps: [Int] = [25, 50, 75, 100]

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
                // Left Tactile Completion Ring with Progress Arc
                Button {
                    guard !isMarkingComplete, !isOffline, task.status != .selesai else { return }
                    HapticsHelper.notificationSuccess()
                    withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.taskCompletion, reduceMotion: reduceMotion)) {
                        isMarkingComplete = true
                        localProgress = 100
                    }
                    onMarkCompleted?()
                } label: {
                    ZStack {
                        if isMarkingComplete {
                            ProgressView()
                                .controlSize(.small)
                                .tint(AppTheme.Colors.success)
                                .frame(width: 26, height: 26)
                        } else if task.status == .selesai {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(AppTheme.Colors.success)
                                .transition(.scale(scale: 0.92).combined(with: .opacity))
                        } else {
                            Circle()
                                .stroke(
                                    isOffline ? AppTheme.Colors.borderSubtle : AppTheme.Colors.borderStrong,
                                    lineWidth: 1.75
                                )
                                .frame(width: 22, height: 22)

                            if localProgress > 0 {
                                Circle()
                                    .trim(from: 0, to: CGFloat(min(100, max(0, localProgress))) / 100.0)
                                    .stroke(
                                        courseAccent,
                                        style: StrokeStyle(lineWidth: 2.2, lineCap: .round)
                                    )
                                    .rotationEffect(.degrees(-90))
                                    .frame(width: 22, height: 22)
                            }
                        }
                    }
                    .frame(width: 26, height: 26)
                }
                .buttonStyle(.plain)
                .disabled(isMarkingComplete || isOffline || task.status == .selesai)
                .padding(.top, 2)
                .accessibilityLabel(task.status == .selesai ? "Tugas selesai" : "Tandai tugas selesai")

                // Main Task Content Area
                VStack(alignment: .leading, spacing: 7) {
                    // Header Metadata & Expand/Edit Controls
                    HStack(spacing: 6) {
                        if task.isPinned {
                            HStack(spacing: 3) {
                                Image(systemName: "pin.fill")
                                    .font(.system(size: 9, weight: .bold))
                                Text("Semat")
                                    .font(AppTheme.Typography.badge)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2.5)
                            .background(AppTheme.Colors.primaryMuted)
                            .foregroundStyle(AppTheme.Colors.primary)
                            .clipShape(Capsule())
                        }

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

                        if let course = task.jadwal?.namaMatkul {
                            Text(course)
                                .font(AppTheme.Typography.badge)
                                .lineLimit(1)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2.5)
                                .background(courseAccent.opacity(0.13))
                                .foregroundStyle(courseAccent)
                                .clipShape(Capsule())
                        } else {
                            Text(task.jenis.rawValue)
                                .font(AppTheme.Typography.badge)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2.5)
                                .background(AppTheme.Colors.neutralBackground)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .clipShape(Capsule())
                        }

                        Spacer(minLength: 4)

                        // Interactive Progress Pill Toggle (membuka laci progres inline)
                        if task.status != .selesai {
                            Button {
                                HapticsHelper.selectionChanged()
                                withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.inlineExpand, reduceMotion: reduceMotion)) {
                                    isExpanded.toggle()
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    Text("\(Int(localProgress))%")
                                        .font(.system(size: 11, weight: .bold, design: .rounded))
                                        .monospacedDigit()
                                        .contentTransition(.numericText())
                                    Image(systemName: isExpanded ? "chevron.up" : "slider.horizontal.3")
                                        .font(.system(size: 9, weight: .bold))
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .foregroundStyle(isExpanded ? .white : courseAccent)
                                .background(
                                    Capsule()
                                        .fill(isExpanded ? courseAccent : courseAccent.opacity(0.13))
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Atur progres tugas, saat ini \(Int(localProgress)) persen")
                        }
                    }

                    // Task Title
                    Text(task.namaTugas)
                        .font(AppTheme.Typography.cardTitle)
                        .strikethrough(task.status == .selesai)
                        .foregroundStyle(task.status == .selesai ? AppTheme.Colors.textTertiary : AppTheme.Colors.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    // Deadline & Urgency Row
                    HStack(spacing: 6) {
                        Image(systemName: "calendar")
                            .font(.caption2)
                            .foregroundStyle(AppTheme.Colors.textSecondary)

                        Text(task.deadline.formatted(date: .abbreviated, time: .omitted))
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                            .monospacedDigit()

                        if task.status != .selesai {
                            if daysDifference < 0 {
                                urgencyChip("Terlewat", color: AppTheme.Colors.urgent)
                            } else if daysDifference == 0 {
                                urgencyChip("Hari Ini", color: AppTheme.Colors.warning)
                            } else if daysDifference == 1 {
                                urgencyChip("Besok", color: AppTheme.Colors.warning)
                            } else if daysDifference <= 3 {
                                urgencyChip("\(daysDifference) hari lagi", color: courseAccent)
                            }
                        }

                        if let reminderDate = task.reminderAt, task.status != .selesai {
                            Button {
                                onConfigureReminder?()
                            } label: {
                                HStack(spacing: 3) {
                                    Image(systemName: "bell.fill")
                                        .font(.system(size: 9, weight: .bold))
                                    Text(reminderDate.formatted(date: .omitted, time: .shortened))
                                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                                        .monospacedDigit()
                                }
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(AppTheme.Colors.warningMuted)
                                .foregroundStyle(AppTheme.Colors.warning)
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }

                        Spacer()

                        if let onEdit = onEdit, !isExpanded {
                            Button(action: onEdit) {
                                Image(systemName: "pencil")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                    .padding(4)
                            }
                            .buttonStyle(.plain)
                            .disabled(isMarkingComplete || isOffline)
                        }
                    }

                    // Compact Progress Bar (Default Clean View)
                    if !isExpanded && task.status != .selesai {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(AppTheme.Colors.tertiarySurface)
                                    .frame(height: 4)

                                Capsule()
                                    .fill(courseAccent)
                                    .frame(
                                        width: max(4, geo.size.width * CGFloat(min(100, max(0, localProgress))) / 100.0),
                                        height: 4
                                    )
                            }
                        }
                        .frame(height: 4)
                        .padding(.top, 2)
                    }
                }
            }

            // Inline Expandable Progress & Quick Actions Drawer
            if isExpanded && task.status != .selesai {
                VStack(alignment: .leading, spacing: 10) {
                    Divider()
                        .overlay(AppTheme.Colors.divider)

                    HStack {
                        Text("PERBARUI PROGRES CEPAT")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.6)
                            .foregroundStyle(AppTheme.Colors.textSecondary)

                        Spacer()

                        if let onEdit = onEdit {
                            Button {
                                onEdit()
                            } label: {
                                Label("Edit Tugas", systemImage: "pencil")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(AppTheme.Colors.primary)
                            }
                            .buttonStyle(.plain)
                            .disabled(isOffline)
                        }
                    }

                    // One-Tap Quick Progress Chips
                    HStack(spacing: 6) {
                        ForEach(quickSteps, id: \.self) { step in
                            let isCurrent = Int(localProgress) == step
                            Button {
                                guard !isOffline else { return }
                                HapticsHelper.selectionChanged()
                                withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.inlineExpand, reduceMotion: reduceMotion)) {
                                    localProgress = Double(step)
                                }
                                if step == 100 {
                                    onMarkCompleted?()
                                } else {
                                    onProgressChanged?(step)
                                }
                            } label: {
                                Text(step == 100 ? "Selesai ✓" : "\(step)%")
                                    .font(.caption2.weight(.bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 6)
                                    .foregroundStyle(
                                        isCurrent
                                            ? .white
                                            : (step == 100 ? AppTheme.Colors.success : AppTheme.Colors.textPrimary)
                                    )
                                    .background(
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .fill(
                                                isCurrent
                                                    ? (step == 100 ? AppTheme.Colors.success : courseAccent)
                                                    : (step == 100 ? AppTheme.Colors.successMuted : AppTheme.Colors.tertiarySurface)
                                            )
                                    )
                            }
                            .buttonStyle(PressableScaleButtonStyle())
                            .disabled(isOffline)
                        }
                    }

                    // Fine-Grained Slider Scrubber
                    Slider(value: $localProgress, in: 0...100, step: 5) {
                        Text("Progress")
                    } onEditingChanged: { isEditing in
                        if !isEditing && !isOffline {
                            let target = Int(localProgress)
                            if target >= 100 {
                                onMarkCompleted?()
                            } else {
                                onProgressChanged?(target)
                            }
                        }
                    }
                    .tint(isOffline ? AppTheme.Colors.textTertiary : courseAccent)
                    .disabled(isOffline)
                }
                .padding(.top, 2)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .opacity.combined(with: .scale(scale: 0.97, anchor: .top))
                )
            }
        }
        .cardSurface(
            strokeColor: isExpanded
                ? courseAccent.opacity(0.38)
                : (task.isPinned ? AppTheme.Colors.primary.opacity(0.32) : AppTheme.Colors.borderSubtle),
            strokeWidth: 1
        )
        .onChange(of: task.progress) { _, newProgress in
            localProgress = Double(newProgress)
            isMarkingComplete = false
            if newProgress >= 100 {
                isExpanded = false
            }
        }
    }

    private func urgencyChip(_ label: String, color: Color) -> some View {
        Text(label)
            .font(.system(size: 10, weight: .bold, design: .rounded))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundStyle(color)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
