import SwiftUI

/// Jenis alur pembuatan cepat (Quick Composer) yang didukung oleh Gooey Action Dock.
public enum QuickComposerKind: String, CaseIterable, Identifiable, Sendable {
    case task = "task"
    case replacement = "replacement"
    case course = "course"
    case exam = "exam"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .task:
            return "Tambah Tugas"
        case .replacement:
            return "Kelas Pengganti"
        case .course:
            return "Mata Kuliah Baru"
        case .exam:
            return "Jadwal Ujian"
        }
    }

    public var subtitle: String {
        switch self {
        case .task:
            return "Tenggat, prioritas & target mata kuliah"
        case .replacement:
            return "Sesi pengganti tatap muka atau daring"
        case .course:
            return "Jadwal kuliah reguler mingguan"
        case .exam:
            return "UTS, UAS, kuis, atau praktikum"
        }
    }

    public var iconName: String {
        switch self {
        case .task:
            return "checklist.checked"
        case .replacement:
            return "arrow.triangle.2.circlepath.circle.fill"
        case .course:
            return "book.closed.fill"
        case .exam:
            return "doc.text.magnifyingglass"
        }
    }

    public var accentColor: Color {
        switch self {
        case .task:
            return AppTheme.Colors.primary
        case .replacement:
            return AppTheme.Colors.warning
        case .course:
            return AppTheme.Colors.success
        case .exam:
            return AppTheme.Colors.danger
        }
    }
}

/// Aksi bertipe kanonik pada Gooey Action Dock:
/// memisahkan alur pembuatan (`create`) dari utilitas aktivitas akademik (`openInbox`).
public enum DockAction: Hashable, Identifiable, Sendable {
    case create(QuickComposerKind)
    case openInbox

    public var id: String {
        switch self {
        case .create(let kind):
            return "create-\(kind.rawValue)"
        case .openInbox:
            return "open-inbox"
        }
    }

    public static var allDockActions: [DockAction] {
        QuickComposerKind.allCases.map { .create($0) } + [.openInbox]
    }
}

/// Fase koreografi multi-tahap untuk **Gooey Action Dock**:
/// - Pembukaan: `.closed` → `.pressing` (`scale(0.95)`) → `.expandingBubble` (bubble keluar & morph jadi panel) → `.open` (item menu masuk bertahap).
/// - Penutupan: `.open` → `.collapsingItems` (item & teks hilang lebih dulu) → `.collapsingBubble` (panel menyusut kembali ke bubble `+`) → `.closed` (bersih tanpa panel transparan sisa).
public enum GooeyDockPhase: String, Sendable, Equatable {
    case closed
    case pressing
    case expandingBubble
    case open
    case collapsingItems
    case collapsingBubble
}

/// PreferenceKey untuk melaporkan koordinat nyata tujuan Inbox/Dock ke `ActivityInboxStore.shared.inboxTargetRect`.
public struct InboxTargetRectPreferenceKey: PreferenceKey {
    public nonisolated(unsafe) static var defaultValue: CGRect = .zero
    public static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        let candidate = nextValue()
        if candidate != .zero {
            value = candidate
        }
    }
}

/// Bentuk jembatan cair (metaball/liquid stem) yang menghubungkan tombol trigger utama dengan kartu menu di atasnya
/// secara kontinu selama animasi ekspansi dan penutupan.
/// Ketika `progress <= 0.02`, mengembalikan `Path` kosong agar tidak ada residu visual saat tertutup.
public struct GooeyDockBridgeShape: Shape {
    public var progress: CGFloat

    public var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    public init(progress: CGFloat) {
        self.progress = progress
    }

    public func path(in rect: CGRect) -> Path {
        let clamped = max(0, min(1, progress))
        guard clamped > 0.02 else { return Path() }

        var path = Path()
        let baseRadius: CGFloat = 26 * clamped
        let baseCenter = CGPoint(x: rect.midX, y: rect.maxY - 28)
        path.addEllipse(
            in: CGRect(
                x: baseCenter.x - baseRadius,
                y: baseCenter.y - baseRadius,
                width: baseRadius * 2,
                height: baseRadius * 2
            )
        )

        // Leher cair yang menyempit di tengah lalu melebar menyatu ke dasar kontainer menu
        let stemHeight: CGFloat = 34 * clamped
        let topY = baseCenter.y - baseRadius - stemHeight + 8
        let bottomY = baseCenter.y - baseRadius + 10
        let waistWidth: CGFloat = 18 + (10 * (1 - clamped))
        let flareWidth: CGFloat = 44 * clamped

        var neck = Path()
        neck.move(to: CGPoint(x: baseCenter.x - flareWidth * 0.55, y: bottomY))
        neck.addQuadCurve(
            to: CGPoint(x: baseCenter.x - flareWidth * 0.72, y: topY),
            control: CGPoint(x: baseCenter.x - waistWidth * 0.5, y: (topY + bottomY) * 0.5)
        )
        neck.addLine(to: CGPoint(x: baseCenter.x + flareWidth * 0.72, y: topY))
        neck.addQuadCurve(
            to: CGPoint(x: baseCenter.x + flareWidth * 0.55, y: bottomY),
            control: CGPoint(x: baseCenter.x + waistWidth * 0.5, y: (topY + bottomY) * 0.5)
        )
        neck.closeSubpath()
        path.addPath(neck)

        return path
    }
}

/// Pengendali state untuk Gooey Action Dock, Morphing Quick Composer, & Kotak Aktivitas (Inbox).
/// Memastikan koreografi pembukaan dan penutupan multi-tahap berjalan mulus tanpa artefak panel transparan.
@Observable
@MainActor
public final class QuickActionDockController {
    public var isExpanded: Bool = false
    public var phase: GooeyDockPhase = .closed
    public var activeComposer: QuickComposerKind? = nil
    private var choreographyTask: Task<Void, Never>? = nil

    public init() {}

    /// Apakah permukaan panel menu sedang dirender di hierarki view.
    /// Bernilai `false` sepenuhnya saat `.closed` atau `.pressing` sehingga tidak ada panel transparan sisa.
    public var isPanelSurfaceRendered: Bool {
        switch phase {
        case .expandingBubble, .open, .collapsingItems:
            return true
        case .closed, .pressing, .collapsingBubble:
            return isExpanded
        }
    }

    /// Apakah item menu & teks di dalam panel sedang ditampilkan.
    /// Pada saat penutupan (`.collapsingItems`), bernilai `false` terlebih dahulu sebelum panel menyusut.
    public var areMenuItemsRevealed: Bool {
        phase == .open || (isExpanded && phase != .pressing && phase != .expandingBubble)
    }

    /// Progres jembatan cair (`0.0` saat tertutup, `1.0` saat bubble/panel terekspansi).
    public var bridgeProgress: CGFloat {
        switch phase {
        case .expandingBubble, .open:
            return 1.0
        case .collapsingItems:
            return 0.65
        case .closed, .pressing, .collapsingBubble:
            return isExpanded ? 1.0 : 0.0
        }
    }

    /// Skala kompresi tombol `+` saat mulai ditekan (`0.95` pada `.pressing`).
    public var triggerCompressionScale: CGFloat {
        phase == .pressing ? 0.95 : 1.0
    }

    public func toggleDock(reduceMotion: Bool = false) {
        choreographyTask?.cancel()

        if activeComposer != nil {
            withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.dockCollapse, reduceMotion: reduceMotion)) {
                activeComposer = nil
                isExpanded = false
                phase = .closed
            }
            return
        }

        if isExpanded {
            closeDock(reduceMotion: reduceMotion)
        } else {
            openDock(reduceMotion: reduceMotion)
        }
    }

    /// Menjalankan urutan pembukaan 5-tahap:
    /// 1. Kompresi tekan (`scale(0.95)`)
    /// 2. Bubble keluar dari tombol `+`
    /// 3. Bubble morph menjadi panel
    /// 4. Panel mencapai ukuran penuh
    /// 5. Item menu masuk bertahap (stagger 35ms)
    public func openDock(reduceMotion: Bool = false) {
        choreographyTask?.cancel()
        activeComposer = nil
        isExpanded = true

        if reduceMotion {
            withAnimation(AppTheme.Motion.reducedMotionFallback) {
                phase = .open
            }
            return
        }

        HapticsHelper.lightImpact()
        withAnimation(AppTheme.Motion.dockPress) {
            phase = .pressing
        }

        choreographyTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 45_000_000)
            guard let self, !Task.isCancelled, self.isExpanded else { return }

            withAnimation(AppTheme.Motion.dockExpand) {
                self.phase = .expandingBubble
            }

            try? await Task.sleep(nanoseconds: 75_000_000)
            guard !Task.isCancelled, self.isExpanded else { return }

            withAnimation(AppTheme.Motion.dockExpand) {
                self.phase = .open
            }
        }
    }

    /// Menjalankan urutan penutupan 3-tahap secara terbalik:
    /// 1. Item menu dan teks menghilang lebih dulu (`.collapsingItems`)
    /// 2. Panel menyusut kembali ke dalam bubble (`.collapsingBubble`)
    /// 3. Bubble kembali ke tombol `+` (`.closed`) tanpa menyisakan overlay transparan
    public func closeDock(reduceMotion: Bool = false) {
        choreographyTask?.cancel()
        isExpanded = false

        if reduceMotion {
            withAnimation(AppTheme.Motion.reducedMotionFallback) {
                phase = .closed
            }
            return
        }

        HapticsHelper.lightImpact()
        withAnimation(AppTheme.Motion.dockItemsExit) {
            phase = .collapsingItems
        }

        choreographyTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 85_000_000)
            guard let self, !Task.isCancelled, !self.isExpanded else { return }

            withAnimation(AppTheme.Motion.dockCollapse) {
                self.phase = .collapsingBubble
            }

            try? await Task.sleep(nanoseconds: 180_000_000)
            guard !Task.isCancelled, !self.isExpanded else { return }

            withAnimation(AppTheme.Motion.dockCollapse) {
                self.phase = .closed
            }
        }
    }

    public func performAction(
        _ action: DockAction,
        inboxStore: ActivityInboxStore = .shared,
        reduceMotion: Bool = false
    ) {
        choreographyTask?.cancel()
        switch action {
        case .create(let kind):
            selectAction(kind, reduceMotion: reduceMotion)
        case .openInbox:
            HapticsHelper.selectionChanged()
            withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.dockCollapse, reduceMotion: reduceMotion)) {
                isExpanded = false
                phase = .closed
                activeComposer = nil
            }
            inboxStore.dismissActiveFlight(reduceMotion: reduceMotion)
            inboxStore.isPresentingInboxSheet = true
        }
    }

    public func selectAction(_ kind: QuickComposerKind, reduceMotion: Bool = false) {
        choreographyTask?.cancel()
        HapticsHelper.selectionChanged()
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelMorph, reduceMotion: reduceMotion)) {
            isExpanded = false
            phase = .closed
            activeComposer = kind
        }
    }

    public func dismissComposer(reduceMotion: Bool = false) {
        choreographyTask?.cancel()
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelDismiss, reduceMotion: reduceMotion)) {
            activeComposer = nil
            isExpanded = false
            phase = .closed
        }
    }

    public func resetStateImmediate() {
        choreographyTask?.cancel()
        isExpanded = false
        phase = .closed
        activeComposer = nil
    }
}

/// Signature Interaction 01 — TrackerThings Gooey Action Dock.
/// Satu-satunya titik masuk kanonik untuk pembuatan cepat akademik ("Buat Cepat") dan Kotak Aktivitas ("Inbox").
/// Dilengkapi koreografi pembukaan/penutupan multi-tahap, jembatan cair animatable (`GooeyDockBridgeShape`),
/// pengelompokan jelas (Create vs Activity), serta posisi stabil di atas `FrostedGlideTabBar`.
public struct GooeyActionDock: View {
    @Bindable var controller: QuickActionDockController
    @Bindable var inboxStore: ActivityInboxStore
    var morphNamespace: Namespace.ID
    var hasCourses: Bool

    @Namespace private var bubbleMorphNamespace
    @State private var isBadgePulsing: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    public init(
        controller: QuickActionDockController,
        inboxStore: ActivityInboxStore = .shared,
        morphNamespace: Namespace.ID,
        hasCourses: Bool
    ) {
        self.controller = controller
        self.inboxStore = inboxStore
        self.morphNamespace = morphNamespace
        self.hasCourses = hasCourses
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Backdrop Scrim hanya saat panel terbuka
            if controller.isPanelSurfaceRendered {
                Color.black
                    .opacity(colorScheme == .dark ? 0.44 : 0.20)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture {
                        controller.toggleDock(reduceMotion: reduceMotion)
                    }
                    .accessibilityLabel("Tutup menu aksi cepat")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction(.escape) {
                        controller.toggleDock(reduceMotion: reduceMotion)
                    }
            }

            // Connected Gooey Container + Trigger Button
            VStack(alignment: .trailing, spacing: 0) {
                if controller.isPanelSurfaceRendered {
                    expandedMenuSurface
                        .padding(.bottom, 10)
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .asymmetric(
                                    insertion: .scale(scale: 0.22, anchor: .bottomTrailing)
                                        .combined(with: .opacity)
                                        .combined(with: .offset(y: 24)),
                                    removal: .scale(scale: 0.18, anchor: .bottomTrailing)
                                        .combined(with: .opacity)
                                        .combined(with: .offset(y: 28))
                                )
                        )
                }

                // Trigger Button dengan Liquid Metaball Stem & Unread Badge
                ZStack(alignment: .topTrailing) {
                    // Jembatan cair hanya dirender selama transisi buka/tutup (nol residu saat tertutup)
                    if !reduceMotion && controller.bridgeProgress > 0.01 {
                        GooeyDockBridgeShape(progress: controller.bridgeProgress)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.Colors.secondarySurface,
                                        AppTheme.Colors.primary
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(width: 76, height: 84)
                            .offset(y: -26)
                            .allowsHitTesting(false)
                            .transition(.opacity)
                    }

                    Button {
                        controller.toggleDock(reduceMotion: reduceMotion)
                    } label: {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            AppTheme.Colors.primary,
                                            AppTheme.Colors.accentPressed
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 56, height: 56)
                                .overlay(
                                    Circle()
                                        .strokeBorder(Color.white.opacity(0.26), lineWidth: 1)
                                )
                                .shadow(
                                    color: AppTheme.Colors.primary.opacity(colorScheme == .dark ? 0.40 : 0.28),
                                    radius: controller.isExpanded ? 18 : 12,
                                    x: 0,
                                    y: 6
                                )

                            Image(systemName: "plus")
                                .font(.system(size: 21, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .rotationEffect(.degrees(controller.isExpanded ? 45 : 0))
                        }
                        .scaleEffect(controller.triggerCompressionScale * (isBadgePulsing ? 1.10 : 1.0))
                    }
                    .buttonStyle(PressableScaleButtonStyle())
                    .background(
                        GeometryReader { geo in
                            Color.clear.preference(
                                key: InboxTargetRectPreferenceKey.self,
                                value: geo.frame(in: .named("RootInteractiveSpace"))
                            )
                        }
                    )
                    .accessibilityIdentifier("GooeyActionDock.triggerButton")
                    .accessibilityLabel(
                        controller.isExpanded
                            ? "Tutup menu aksi cepat"
                            : "Menu aksi cepat dan Kotak Aktivitas, \(inboxStore.unreadCount) belum dibaca"
                    )
                    .accessibilityHint("Membuka pilihan Buat Cepat dan Kotak Aktivitas Akademik")
                    .accessibilityAction(.escape) {
                        if controller.isExpanded {
                            controller.toggleDock(reduceMotion: reduceMotion)
                        }
                    }

                    // Unread Activity Badge pada Trigger Utama (saat menu tertutup)
                    if !controller.isPanelSurfaceRendered && inboxStore.unreadCount > 0 {
                        HStack(spacing: 3) {
                            if inboxStore.hasUrgentUnread {
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 5, height: 5)
                            }
                            Text("\(min(99, inboxStore.unreadCount))")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.white)
                                .contentTransition(.numericText())
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(
                            Capsule()
                                .fill(inboxStore.hasUrgentUnread ? AppTheme.Colors.danger : AppTheme.Colors.primary)
                        )
                        .overlay(
                            Capsule()
                                .strokeBorder(AppTheme.Colors.background, lineWidth: 1.5)
                        )
                        .offset(x: 4, y: -4)
                        .scaleEffect(isBadgePulsing ? 1.22 : 1.0)
                        .allowsHitTesting(false)
                    }
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 76)
        }
        .onPreferenceChange(InboxTargetRectPreferenceKey.self) { newRect in
            if newRect != .zero {
                Task { @MainActor in
                    inboxStore.inboxTargetRect = newRect
                }
            }
        }
        .onChange(of: inboxStore.badgePulseTrigger) { _, _ in
            guard !reduceMotion else { return }
            withAnimation(AppTheme.Motion.badgePulse) {
                isBadgePulsing = true
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 240_000_000)
                withAnimation(AppTheme.Motion.badgePulse) {
                    isBadgePulsing = false
                }
            }
        }
    }

    // MARK: - Connected Expanded Menu Surface (Two Purposeful Groups)

    private var expandedMenuSurface: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 10) {
                // GROUP 1: BUAT CEPAT (QUICK CREATE)
                HStack {
                    Text("BUAT CEPAT")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(0.8)
                        .foregroundStyle(AppTheme.Colors.textTertiary)
                    Spacer()
                }
                .padding(.horizontal, 6)
                .padding(.top, 2)
                .opacity(controller.areMenuItemsRevealed ? 1.0 : 0.0)

                VStack(spacing: 6) {
                    ForEach(Array(QuickComposerKind.allCases.enumerated()), id: \.element.id) { index, kind in
                        quickCreateRow(for: kind, index: index)
                    }
                }

                Divider()
                    .overlay(AppTheme.Colors.divider)
                    .padding(.vertical, 2)
                    .opacity(controller.areMenuItemsRevealed ? 1.0 : 0.0)

                // GROUP 2: AKTIVITAS AKADEMIK (INBOX)
                HStack {
                    Text("AKTIVITAS AKADEMIK")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(0.8)
                        .foregroundStyle(AppTheme.Colors.textTertiary)
                    Spacer()
                    if inboxStore.unreadCount > 0 {
                        Text("\(inboxStore.unreadCount) baru")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(inboxStore.hasUrgentUnread ? AppTheme.Colors.danger : AppTheme.Colors.primary)
                    }
                }
                .padding(.horizontal, 6)
                .opacity(controller.areMenuItemsRevealed ? 1.0 : 0.0)

                inboxActionRow(index: QuickComposerKind.allCases.count)
            }
            .padding(12)
        }
        .frame(width: 288)
        .frame(maxHeight: 388)
        .fixedSize(horizontal: false, vertical: true)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(AppTheme.Colors.secondarySurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(AppTheme.Colors.borderStrong.opacity(0.65), lineWidth: 1)
        )
        .shadow(
            color: Color.black.opacity(colorScheme == .dark ? 0.44 : 0.16),
            radius: 22,
            x: 0,
            y: 10
        )
    }

    // MARK: - Group 1 Row: Quick Create Action

    @ViewBuilder
    private func quickCreateRow(for kind: QuickComposerKind, index: Int) -> some View {
        let isDisabledByMissingCourse = !hasCourses && (kind == .task || kind == .replacement || kind == .exam)
        let isRevealed = controller.areMenuItemsRevealed

        Button {
            if isDisabledByMissingCourse {
                controller.performAction(.create(.course), inboxStore: inboxStore, reduceMotion: reduceMotion)
            } else {
                controller.performAction(.create(kind), inboxStore: inboxStore, reduceMotion: reduceMotion)
            }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(kind.accentColor.opacity(0.15))
                        .frame(width: 38, height: 38)

                    Image(systemName: kind.iconName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(kind.accentColor)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(kind.title)
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(AppTheme.Colors.textPrimary)

                    Text(isDisabledByMissingCourse ? "Buat mata kuliah terlebih dahulu" : kind.subtitle)
                        .font(.caption2)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 4)

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(AppTheme.Colors.textTertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(AppTheme.Colors.tertiarySurface.opacity(0.75))
                    .matchedGeometryEffect(id: "composer-surface-\(kind.rawValue)", in: morphNamespace)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(kind.accentColor.opacity(0.20), lineWidth: 1)
            )
            .opacity(isRevealed ? 1.0 : 0.0)
            .offset(y: isRevealed ? 0 : 10)
            .scaleEffect(isRevealed ? 1.0 : 0.94, anchor: .bottomTrailing)
        }
        .buttonStyle(PressableScaleButtonStyle(hapticStyle: nil))
        .animation(
            isRevealed
                ? AppTheme.Motion.menuItemEntrance(index: index, reduceMotion: reduceMotion)
                : AppTheme.Motion.dockItemsExit,
            value: isRevealed
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(kind.title). \(kind.subtitle)")
    }

    // MARK: - Group 2 Row: Academic Activity Inbox

    @ViewBuilder
    private func inboxActionRow(index: Int) -> some View {
        let hasUnread = inboxStore.unreadCount > 0
        let accent = inboxStore.hasUrgentUnread ? AppTheme.Colors.danger : AppTheme.Colors.primary
        let isRevealed = controller.areMenuItemsRevealed

        Button {
            controller.performAction(.openInbox, inboxStore: inboxStore, reduceMotion: reduceMotion)
        } label: {
            HStack(spacing: 12) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(accent.opacity(0.16))
                        .frame(width: 38, height: 38)

                    Image(systemName: hasUnread ? "tray.full.fill" : "tray.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(accent)
                        .frame(width: 38, height: 38)

                    if inboxStore.hasUrgentUnread {
                        Circle()
                            .fill(AppTheme.Colors.danger)
                            .frame(width: 8, height: 8)
                            .overlay(
                                Circle().strokeBorder(AppTheme.Colors.secondarySurface, lineWidth: 1.5)
                            )
                            .offset(x: 2, y: -2)
                    }
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Kotak Aktivitas")
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(AppTheme.Colors.textPrimary)

                    Text(
                        hasUnread
                            ? "\(inboxStore.unreadCount) pembaruan belum dibaca"
                            : "Pengingat tenggat, ujian & riwayat"
                    )
                    .font(.caption2)
                    .foregroundStyle(hasUnread ? accent : AppTheme.Colors.textSecondary)
                    .lineLimit(1)
                }

                Spacer(minLength: 4)

                if hasUnread {
                    Text("\(inboxStore.unreadCount)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(accent)
                        )
                        .contentTransition(.numericText())
                } else {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(AppTheme.Colors.textTertiary)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(hasUnread ? accent.opacity(0.10) : AppTheme.Colors.tertiarySurface.opacity(0.75))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(hasUnread ? accent.opacity(0.35) : AppTheme.Colors.borderSubtle, lineWidth: 1)
            )
            .opacity(isRevealed ? 1.0 : 0.0)
            .offset(y: isRevealed ? 0 : 10)
            .scaleEffect(isRevealed ? 1.0 : 0.94, anchor: .bottomTrailing)
        }
        .buttonStyle(PressableScaleButtonStyle(hapticStyle: nil))
        .animation(
            isRevealed
                ? AppTheme.Motion.menuItemEntrance(index: index, reduceMotion: reduceMotion)
                : AppTheme.Motion.dockItemsExit,
            value: isRevealed
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Kotak Aktivitas Akademik, \(inboxStore.unreadCount) belum dibaca")
        .accessibilityHint("Membuka daftar pengingat tugas, jadwal ujian, dan pembaruan akademik")
    }
}
