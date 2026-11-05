import SwiftUI

/// State machine deterministik untuk interaksi geser (swipe) pada baris tugas akademik.
public enum TaskSwipeState: Equatable, Sendable {
    case closed
    case revealingPin
    case pinActionVisible
    case revealingReminder
    case reminderActionVisible
    case committing
    case closing
}

/// Hasil evaluasi akhir saat pengguna melepas jari dari gesture geser horizontal.
public enum TaskSwipeReleaseOutcome: Equatable, Sendable {
    case snapClosed
    case snapPinVisible
    case snapReminderVisible
    case commitPinImmediate
    case openReminderImmediate
}

/// Koordinator bersama untuk memastikan hanya satu baris tugas yang terbuka pada satu waktu
/// serta menyediakan perhitungan fisika dan ambang batas (threshold) yang dapat diuji secara unit test.
@Observable
@MainActor
public final class TaskSwipeCoordinator {
    public var activeOpenTaskId: Int? = nil

    public static let directionLockMinimumDistance: CGFloat = 12
    public static let directionLockHorizontalRatio: CGFloat = 1.35
    public static let leftEdgeProtectionWidth: CGFloat = 24
    public static let actionRevealWidth: CGFloat = 88
    public static let revealSnapThreshold: CGFloat = 52
    public static let fullCommitThreshold: CGFloat = 148

    public init() {}

    /// Menentukan apakah gesture harus diabaikan karena dimulai dari area tepi kiri layar (proteksi back-swipe).
    public static func isLeftEdgeBackGesture(startX: CGFloat) -> Bool {
        startX < leftEdgeProtectionWidth
    }

    /// Menentukan apakah pergeseran jari memenuhi syarat dikunci sebagai gesture geser horizontal
    /// dan bukan pengguliran vertikal `ScrollView`.
    public static func shouldLockHorizontal(deltaX: CGFloat, deltaY: CGFloat) -> Bool {
        let absX = abs(deltaX)
        let absY = abs(deltaY)
        guard absX >= directionLockMinimumDistance else { return false }
        return absX > (absY * directionLockHorizontalRatio)
    }

    /// Menghitung offset horizontal baris dengan hambatan elastis (rubber-band resistance)
    /// ketika melampaui lebar area tombol aksi.
    public static func rubberBandedOffset(for rawTranslation: CGFloat) -> CGFloat {
        let sign: CGFloat = rawTranslation >= 0 ? 1 : -1
        let magnitude = abs(rawTranslation)
        if magnitude <= actionRevealWidth {
            return rawTranslation
        }
        let excess = magnitude - actionRevealWidth
        let dampedExcess = excess * 0.34
        return sign * min(fullCommitThreshold + 24, actionRevealWidth + dampedExcess)
    }

    /// Mengevaluasi state tampilan selama jari pengguna bergerak.
    public static func stateDuringDrag(for offset: CGFloat) -> TaskSwipeState {
        if offset > 4 {
            return .revealingPin
        } else if offset < -4 {
            return .revealingReminder
        }
        return .closed
    }

    /// Mengevaluasi keputusan pelepasan jari berdasarkan offset saat ini dan proyeksi kecepatan akhir.
    public static func evaluateRelease(
        offset: CGFloat,
        predictedEndOffset: CGFloat,
        isOffline: Bool = false
    ) -> TaskSwipeReleaseOutcome {
        guard !isOffline else { return .snapClosed }

        let effectiveRight = max(offset, predictedEndOffset * 0.65)
        let effectiveLeft = min(offset, predictedEndOffset * 0.65)

        if offset > 0 {
            if offset >= fullCommitThreshold || effectiveRight >= (fullCommitThreshold + 20) {
                return .commitPinImmediate
            }
            if offset >= revealSnapThreshold || effectiveRight >= actionRevealWidth {
                return .snapPinVisible
            }
            return .snapClosed
        } else if offset < 0 {
            if abs(offset) >= fullCommitThreshold || abs(effectiveLeft) >= (fullCommitThreshold + 20) {
                return .openReminderImmediate
            }
            if abs(offset) >= revealSnapThreshold || abs(effectiveLeft) >= actionRevealWidth {
                return .snapReminderVisible
            }
            return .snapClosed
        }

        return .snapClosed
    }

    public func registerOpenRow(taskId: Int) {
        activeOpenTaskId = taskId
    }

    public func closeRowIfMatching(taskId: Int) {
        if activeOpenTaskId == taskId {
            activeOpenTaskId = nil
        }
    }

    public func closeAll() {
        activeOpenTaskId = nil
    }
}

/// Pembungkus interaktif untuk baris tugas di Dashboard yang mendukung:
/// - **Geser ke Kanan (Leading)**: Sematkan / Lepas Sematan tugas (`isPinned`).
/// - **Geser ke Kiri (Trailing)**: Atur Pengingat Kustom (`reminderAt`).
/// - **Ketuk (Tap)**: Membuka layar `TaskDetailView` hanya ketika baris sedang tertutup rapat (`state == .closed`).
/// - **VoiceOver**: Menyediakan `.accessibilityAction` bernama untuk kedua aksi tanpa harus menggeser.
public struct SwipeableTaskRow<Content: View>: View {
    public let task: TugasItem
    public var isOffline: Bool
    @Bindable public var coordinator: TaskSwipeCoordinator
    public var onTapRow: () -> Void
    public var onTogglePin: () -> Void
    public var onOpenReminder: () -> Void
    @ViewBuilder public var content: () -> Content

    @State private var swipeState: TaskSwipeState = .closed
    @State private var offsetX: CGFloat = 0
    @State private var baseOffsetX: CGFloat = 0
    @State private var isHorizontalDragLocked: Bool? = nil
    @State private var didFireRevealHaptic: Bool = false
    @State private var didFireFullCommitHaptic: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        task: TugasItem,
        isOffline: Bool = false,
        coordinator: TaskSwipeCoordinator,
        onTapRow: @escaping () -> Void,
        onTogglePin: @escaping () -> Void,
        onOpenReminder: @escaping () -> Void,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.task = task
        self.isOffline = isOffline
        self.coordinator = coordinator
        self.onTapRow = onTapRow
        self.onTogglePin = onTogglePin
        self.onOpenReminder = onOpenReminder
        self.content = content
    }

    private var pinAccentColor: Color {
        task.isPinned ? AppTheme.Colors.textSecondary : AppTheme.Colors.primary
    }

    private var reminderAccentColor: Color {
        AppTheme.Colors.warning
    }

    public var body: some View {
        ZStack {
            // Lapisan latar aksi kontekstual (hanya terlihat saat baris digeser)
            if offsetX != 0 || swipeState != .closed {
                swipeBackgroundLayer
            }

            // Konten kartu tugas utama
            content()
                .offset(x: offsetX)
                .contentShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusCard, style: .continuous))
                .onTapGesture {
                    if swipeState != .closed || abs(offsetX) > 2 {
                        closeRowAnimated()
                    } else {
                        coordinator.closeAll()
                        onTapRow()
                    }
                }
                .simultaneousGesture(horizontalSwipeGesture)
        }
        .onChange(of: coordinator.activeOpenTaskId) { _, activeId in
            if activeId != task.id && (swipeState != .closed || offsetX != 0) {
                closeRowAnimated()
            }
        }
        .accessibilityAction(named: Text(task.isPinned ? "Lepas Sematan Tugas" : "Sematkan Tugas")) {
            guard !isOffline else { return }
            onTogglePin()
        }
        .accessibilityAction(named: Text(task.reminderAt != nil ? "Ubah Pengingat Tugas" : "Atur Pengingat Tugas")) {
            guard !isOffline else { return }
            onOpenReminder()
        }
    }

    // MARK: - Contextual Action Background Layer

    private var swipeBackgroundLayer: some View {
        HStack(spacing: 0) {
            // Sisi Kiri (muncul saat digeser ke KANAN -> Sematkan / Lepas Sematan)
            if offsetX > 0 {
                Button {
                    triggerPinAction()
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: task.isPinned ? "pin.slash.fill" : "pin.fill")
                            .font(.system(size: 16, weight: .bold))
                            .scaleEffect(abs(offsetX) >= TaskSwipeCoordinator.fullCommitThreshold ? 1.18 : 1.0)
                        Text(task.isPinned ? "Lepas" : "Sematkan")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .foregroundStyle(.white)
                    .frame(width: max(TaskSwipeCoordinator.actionRevealWidth, offsetX))
                    .frame(maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusCard, style: .continuous)
                            .fill(pinAccentColor)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(task.isPinned ? "Lepas sematan tugas" : "Sematkan tugas")
            }

            Spacer(minLength: 0)

            // Sisi Kanan (muncul saat digeser ke KIRI -> Atur Pengingat)
            if offsetX < 0 {
                Button {
                    triggerReminderAction()
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: task.reminderAt != nil ? "bell.badge.fill" : "bell.fill")
                            .font(.system(size: 16, weight: .bold))
                            .scaleEffect(abs(offsetX) >= TaskSwipeCoordinator.fullCommitThreshold ? 1.18 : 1.0)
                        Text("Pengingat")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .foregroundStyle(.white)
                    .frame(width: max(TaskSwipeCoordinator.actionRevealWidth, abs(offsetX)))
                    .frame(maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusCard, style: .continuous)
                            .fill(reminderAccentColor)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Atur pengingat tugas")
            }
        }
    }

    // MARK: - Horizontal Drag Gesture with Direction Locking & Edge Protection

    private var horizontalSwipeGesture: some Gesture {
        DragGesture(minimumDistance: TaskSwipeCoordinator.directionLockMinimumDistance, coordinateSpace: .local)
            .onChanged { value in
                guard !isOffline, task.status != .selesai else { return }

                // Proteksi back-swipe dari tepi kiri layar saat baris sedang tertutup
                if baseOffsetX == 0 && TaskSwipeCoordinator.isLeftEdgeBackGesture(startX: value.startLocation.x) {
                    return
                }

                // Tentukan penguncian arah pada awal gesture
                if isHorizontalDragLocked == nil {
                    let dx = value.translation.width
                    let dy = value.translation.height
                    if TaskSwipeCoordinator.shouldLockHorizontal(deltaX: dx, deltaY: dy) {
                        isHorizontalDragLocked = true
                        coordinator.registerOpenRow(taskId: task.id)
                    } else if abs(dy) > abs(dx) && abs(dy) >= TaskSwipeCoordinator.directionLockMinimumDistance {
                        isHorizontalDragLocked = false
                    }
                }

                guard isHorizontalDragLocked == true else { return }

                let rawTarget = baseOffsetX + value.translation.width
                let damped = TaskSwipeCoordinator.rubberBandedOffset(for: rawTarget)

                withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.swipeFollow, reduceMotion: reduceMotion)) {
                    offsetX = damped
                    swipeState = TaskSwipeCoordinator.stateDuringDrag(for: damped)
                }

                // Umpan balik haptik tepat satu kali saat melewati ambang batas buka aksi & commit penuh
                let absOffset = abs(damped)
                if absOffset >= TaskSwipeCoordinator.revealSnapThreshold && !didFireRevealHaptic {
                    didFireRevealHaptic = true
                    HapticsHelper.selectionChanged()
                } else if absOffset < (TaskSwipeCoordinator.revealSnapThreshold - 8) {
                    didFireRevealHaptic = false
                }

                if absOffset >= TaskSwipeCoordinator.fullCommitThreshold && !didFireFullCommitHaptic {
                    didFireFullCommitHaptic = true
                    HapticsHelper.impactMedium()
                } else if absOffset < (TaskSwipeCoordinator.fullCommitThreshold - 10) {
                    didFireFullCommitHaptic = false
                }
            }
            .onEnded { value in
                defer {
                    isHorizontalDragLocked = nil
                    didFireRevealHaptic = false
                    didFireFullCommitHaptic = false
                }

                guard isHorizontalDragLocked == true else { return }

                let predictedRaw = baseOffsetX + value.predictedEndTranslation.width
                let outcome = TaskSwipeCoordinator.evaluateRelease(
                    offset: offsetX,
                    predictedEndOffset: predictedRaw,
                    isOffline: isOffline
                )

                switch outcome {
                case .snapClosed:
                    closeRowAnimated()

                case .snapPinVisible:
                    withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.swipeSnap, reduceMotion: reduceMotion)) {
                        offsetX = TaskSwipeCoordinator.actionRevealWidth
                        baseOffsetX = TaskSwipeCoordinator.actionRevealWidth
                        swipeState = .pinActionVisible
                        coordinator.registerOpenRow(taskId: task.id)
                    }

                case .snapReminderVisible:
                    withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.swipeSnap, reduceMotion: reduceMotion)) {
                        offsetX = -TaskSwipeCoordinator.actionRevealWidth
                        baseOffsetX = -TaskSwipeCoordinator.actionRevealWidth
                        swipeState = .reminderActionVisible
                        coordinator.registerOpenRow(taskId: task.id)
                    }

                case .commitPinImmediate:
                    triggerPinAction()

                case .openReminderImmediate:
                    triggerReminderAction()
                }
            }
    }

    // MARK: - Action Execution & Row Reset

    private func triggerPinAction() {
        guard !isOffline else {
            closeRowAnimated()
            return
        }
        swipeState = .committing
        HapticsHelper.impactMedium()
        closeRowAnimated()
        onTogglePin()
    }

    private func triggerReminderAction() {
        guard !isOffline else {
            closeRowAnimated()
            return
        }
        swipeState = .committing
        HapticsHelper.selectionChanged()
        closeRowAnimated()
        onOpenReminder()
    }

    private func closeRowAnimated() {
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.swipeSnap, reduceMotion: reduceMotion)) {
            swipeState = .closed
            offsetX = 0
            baseOffsetX = 0
        }
        coordinator.closeRowIfMatching(taskId: task.id)
    }
}
