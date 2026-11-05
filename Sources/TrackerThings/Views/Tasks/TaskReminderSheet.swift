import SwiftUI

/// Pilihan preset waktu pengingat kustom tugas sebelum tenggat pengumpulan.
public enum TaskReminderPreset: String, CaseIterable, Identifiable, Sendable {
    case fifteenMinutesBefore = "15m"
    case oneHourBefore = "1h"
    case oneDayBefore = "1d"
    case custom = "custom"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .fifteenMinutesBefore:
            return "15 menit sebelum"
        case .oneHourBefore:
            return "1 jam sebelum"
        case .oneDayBefore:
            return "1 hari sebelum"
        case .custom:
            return "Atur tanggal & waktu sendiri"
        }
    }

    public var subtitle: String {
        switch self {
        case .fifteenMinutesBefore:
            return "Peringatan cepat menjelang batas waktu"
        case .oneHourBefore:
            return "Waktu ideal untuk pengecekan akhir"
        case .oneDayBefore:
            return "H-1 sebelum tenggat pengumpulan"
        case .custom:
            return "Pilih tanggal dan jam secara bebas"
        }
    }

    public var iconName: String {
        switch self {
        case .fifteenMinutesBefore:
            return "timer"
        case .oneHourBefore:
            return "clock.badge.exclamationmark"
        case .oneDayBefore:
            return "calendar.badge.clock"
        case .custom:
            return "slider.horizontal.3"
        }
    }

    /// Menghitung waktu pengingat berdasarkan batas akhir efektif tugas.
    public func targetDate(for deadline: Date) -> Date? {
        let effective = NotificationService.effectiveDeadline(for: deadline)
        switch self {
        case .fifteenMinutesBefore:
            return effective.addingTimeInterval(-15 * 60)
        case .oneHourBefore:
            return effective.addingTimeInterval(-60 * 60)
        case .oneDayBefore:
            return effective.addingTimeInterval(-24 * 60 * 60)
        case .custom:
            return nil
        }
    }
}

/// Panel kontekstual untuk menjadwalkan atau menghapus pengingat kustom pada tugas akademik (`reminderAt`).
public struct TaskReminderSheet: View {
    public let task: TugasItem
    @Bindable public var viewModel: DashboardViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var selectedPreset: TaskReminderPreset = .oneHourBefore
    @State private var customDate: Date = Date().addingTimeInterval(3600)
    @State private var validationMessage: String? = nil
    @State private var isSaving: Bool = false

    public init(task: TugasItem, viewModel: DashboardViewModel) {
        self.task = task
        self.viewModel = viewModel
    }

    private var effectiveDeadline: Date {
        NotificationService.effectiveDeadline(for: task.deadline)
    }

    private var resolvedReminderDate: Date {
        if let presetDate = selectedPreset.targetDate(for: task.deadline) {
            return presetDate
        }
        return customDate
    }

    private var isResolvedDateValid: Bool {
        NotificationService.isValidCustomReminder(reminderAt: resolvedReminderDate, deadline: task.deadline)
    }

    private var formattedDeadline: String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "id_ID")
        df.dateStyle = .medium
        df.timeStyle = .short
        return df.string(from: effectiveDeadline)
    }

    private func formattedDate(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "id_ID")
        df.dateStyle = .medium
        df.timeStyle = .short
        return df.string(from: date)
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // 1. Ringkasan Tugas & Tenggat
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "bell.badge.fill")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundStyle(AppTheme.Colors.warning)

                            Text(task.jadwal?.namaMatkul ?? "Tugas Akademik")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(AppTheme.Colors.primary)
                                .lineLimit(1)

                            Spacer()

                            if let existing = task.reminderAt {
                                Text("Aktif: \(formattedDate(existing))")
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(AppTheme.Colors.warningMuted)
                                    .foregroundStyle(AppTheme.Colors.warning)
                                    .clipShape(Capsule())
                            }
                        }

                        Text(task.namaTugas)
                            .font(AppTheme.Typography.cardTitle)
                            .foregroundStyle(AppTheme.Colors.textPrimary)

                        Label("Batas akhir: \(formattedDeadline)", systemImage: "calendar")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                    .cardSurface(strokeColor: AppTheme.Colors.borderSubtle)

                    if let validationMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(AppTheme.Colors.danger)
                            Text(validationMessage)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(AppTheme.Colors.danger)
                            Spacer()
                        }
                        .padding(12)
                        .background(AppTheme.Colors.dangerMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    // 2. Pilihan Preset Cepat
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PILIH WAKTU PENGINGAT")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .tracking(0.8)
                            .foregroundStyle(AppTheme.Colors.textSecondary)

                        ForEach(TaskReminderPreset.allCases) { preset in
                            presetRow(for: preset)
                        }
                    }

                    // 3. Pemilih Tanggal & Waktu Kustom
                    if selectedPreset == .custom {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("TANGGAL & JAM PENGINGAT")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .tracking(0.8)
                                .foregroundStyle(AppTheme.Colors.textSecondary)

                            DatePicker(
                                "Waktu pengingat",
                                selection: $customDate,
                                in: Date()...max(Date().addingTimeInterval(60), effectiveDeadline),
                                displayedComponents: [.date, .hourAndMinute]
                            )
                            .datePickerStyle(.graphical)
                            .environment(\.locale, Locale(identifier: "id_ID"))
                            .padding(10)
                            .background(AppTheme.Colors.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    // 4. Tombol Simpan & Hapus Pengingat Kustom
                    VStack(spacing: 10) {
                        Button {
                            Task {
                                await saveReminder()
                            }
                        } label: {
                            SubmitButtonLabel(
                                state: isSaving ? .loading("Menyimpan...") : .idle,
                                idleTitle: "Simpan Pengingat (\(formattedDate(resolvedReminderDate)))",
                                idleIcon: "bell.fill"
                            )
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(isResolvedDateValid ? AppTheme.Colors.primary : AppTheme.Colors.textTertiary)
                            )
                        }
                        .buttonStyle(PressableScaleButtonStyle())
                        .disabled(isSaving || !isResolvedDateValid)

                        if task.reminderAt != nil {
                            Button(role: .destructive) {
                                Task {
                                    await removeReminder()
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "bell.slash.fill")
                                    Text("Hapus Pengingat Kustom")
                                        .font(.subheadline.weight(.semibold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(AppTheme.Colors.dangerMuted)
                                .foregroundStyle(AppTheme.Colors.danger)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .disabled(isSaving)
                        }
                    }
                }
                .padding(16)
            }
            .background(AppTheme.Colors.background.ignoresSafeArea())
            .navigationTitle("Pengingat Tugas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Tutup") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                initializeDefaultSelection()
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func presetRow(for preset: TaskReminderPreset) -> some View {
        let isSelected = selectedPreset == preset
        let candidateDate = preset.targetDate(for: task.deadline)
        let isPresetAvailable: Bool = {
            guard let candidateDate else { return true }
            return NotificationService.isValidCustomReminder(reminderAt: candidateDate, deadline: task.deadline)
        }()

        Button {
            guard isPresetAvailable else {
                validationMessage = "Opsi \(preset.title.lowercased()) sudah terlewat untuk tenggat tugas ini."
                HapticsHelper.notificationWarning()
                return
            }
            validationMessage = nil
            selectedPreset = preset
            if let candidateDate {
                customDate = candidateDate
            }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(isSelected ? AppTheme.Colors.primary : AppTheme.Colors.secondarySurface)
                        .frame(width: 36, height: 36)

                    Image(systemName: preset.iconName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(isSelected ? .white : (isPresetAvailable ? AppTheme.Colors.primary : AppTheme.Colors.textTertiary))
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(preset.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(isPresetAvailable ? AppTheme.Colors.textPrimary : AppTheme.Colors.textTertiary)

                    if let candidateDate {
                        Text(isPresetAvailable ? formattedDate(candidateDate) : "Waktu sudah lewat")
                            .font(.caption2)
                            .foregroundStyle(isPresetAvailable ? AppTheme.Colors.textSecondary : AppTheme.Colors.textTertiary)
                    } else {
                        Text(preset.subtitle)
                            .font(.caption2)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isSelected ? AppTheme.Colors.primary : AppTheme.Colors.borderStrong)
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? AppTheme.Colors.primaryMuted : AppTheme.Colors.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(isSelected ? AppTheme.Colors.primary.opacity(0.45) : AppTheme.Colors.borderSubtle, lineWidth: 1)
            )
        }
        .buttonStyle(PressableScaleButtonStyle())
    }

    private func initializeDefaultSelection() {
        if let existing = task.reminderAt,
           NotificationService.isValidCustomReminder(reminderAt: existing, deadline: task.deadline) {
            selectedPreset = .custom
            customDate = existing
            return
        }

        // Pilih preset pertama yang masih valid di masa depan
        for candidate in [TaskReminderPreset.oneHourBefore, .oneDayBefore, .fifteenMinutesBefore] {
            if let date = candidate.targetDate(for: task.deadline),
               NotificationService.isValidCustomReminder(reminderAt: date, deadline: task.deadline) {
                selectedPreset = candidate
                customDate = date
                return
            }
        }

        selectedPreset = .custom
        let fallback = min(
            Date().addingTimeInterval(1800),
            effectiveDeadline.addingTimeInterval(-300)
        )
        customDate = max(Date().addingTimeInterval(60), fallback)
    }

    private func saveReminder() async {
        validationMessage = nil
        let targetDate = resolvedReminderDate
        guard NotificationService.isValidCustomReminder(reminderAt: targetDate, deadline: task.deadline) else {
            validationMessage = "Pilih waktu di masa depan dan sebelum batas akhir tugas."
            HapticsHelper.notificationWarning()
            return
        }

        isSaving = true
        let ok = await viewModel.updateTaskCustomReminder(task: task, reminderAt: targetDate)
        isSaving = false
        if ok {
            HapticsHelper.notificationSuccess()
            dismiss()
        }
    }

    private func removeReminder() async {
        isSaving = true
        let ok = await viewModel.updateTaskCustomReminder(task: task, reminderAt: nil)
        isSaving = false
        if ok {
            HapticsHelper.impactLight()
            dismiss()
        }
    }
}
