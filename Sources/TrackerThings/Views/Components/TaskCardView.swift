import SwiftUI

public struct TaskCardView: View {
    public let task: TugasItem
    public var onProgressChanged: ((Int) -> Void)?
    public var onEdit: (() -> Void)?
    public var onMarkCompleted: (() -> Void)?

    @State private var localProgress: Double
    @State private var isMarkingComplete: Bool = false

    public init(
        task: TugasItem,
        onProgressChanged: ((Int) -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onMarkCompleted: (() -> Void)? = nil
    ) {
        self.task = task
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
        VStack(alignment: .leading, spacing: 12) {
            // Badges & Actions
            HStack {
                HStack(spacing: 6) {
                    Text(task.prioritas.rawValue)
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(priorityColor.opacity(0.15))
                        .foregroundStyle(priorityColor)
                        .clipShape(Capsule())

                    Text(task.jenis.rawValue)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.secondary.opacity(0.12))
                        .foregroundStyle(.secondary)
                        .clipShape(Capsule())

                    if let course = task.jadwal?.namaMatkul {
                        Text(course)
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.blue.opacity(0.12))
                            .foregroundStyle(.blue)
                            .clipShape(Capsule())
                    }
                }

                Spacer()

                HStack(spacing: 8) {
                    if task.status != .selesai, let onMarkCompleted = onMarkCompleted {
                        Button {
                            guard !isMarkingComplete else { return }
                            isMarkingComplete = true
                            onMarkCompleted()
                        } label: {
                            if isMarkingComplete {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(.green)
                            } else {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.body)
                                    .foregroundStyle(.green)
                            }
                        }
                        .disabled(isMarkingComplete)
                    }

                    if let onEdit = onEdit {
                        Button(action: onEdit) {
                            Image(systemName: "pencil.circle.fill")
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                        .disabled(isMarkingComplete)
                    }
                }
            }

            // Task Name
            Text(task.namaTugas)
                .font(.headline)
                .strikethrough(task.status == .selesai)
                .foregroundStyle(task.status == .selesai ? .secondary : .primary)

            // Deadline Info
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text("Deadline: \(task.deadline.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if task.status != .selesai {
                    if daysDifference < 0 {
                        Text("Terlewat")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.red)
                    } else if daysDifference == 0 {
                        Text("Hari Ini!")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.orange)
                    } else if daysDifference == 1 {
                        Text("Besok")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.orange)
                    }
                }
            }

            Divider()

            // Progress Slider
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Progress Pengerjaan")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(Int(localProgress))%")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.blue)
                }

                Slider(value: $localProgress, in: 0...100, step: 5) {
                    Text("Progress")
                } onEditingChanged: { isEditing in
                    if !isEditing {
                        onProgressChanged?(Int(localProgress))
                    }
                }
                .tint(.blue)
            }
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                .shadow(color: .black.opacity(0.04), radius: 6, x: 0, y: 3)
        }
        .onChange(of: task.progress) { _, newProgress in
            localProgress = Double(newProgress)
            isMarkingComplete = false
        }
    }
}

