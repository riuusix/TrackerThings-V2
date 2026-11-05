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
        var path = Path()

        let baseRadius: CGFloat = 27
        let baseCenter = CGPoint(x: rect.midX, y: rect.maxY - 28)
        path.addEllipse(
            in: CGRect(
                x: baseCenter.x - baseRadius,
                y: baseCenter.y - baseRadius,
                width: baseRadius * 2,
                height: baseRadius * 2
            )
        )

        guard clamped > 0.02 else { return path }

        // Leher cair yang menyempit di tengah lalu melebar menyatu ke dasar kontainer menu
        let stemHeight: CGFloat = 34 * clamped
        let topY = baseCenter.y - baseRadius - stemHeight + 8
        let bottomY = baseCenter.y - baseRadius + 10
        let waistWidth: CGFloat = 18 + (10 * (1 - clamped))
        let flareWidth: CGFloat = 42 * clamped

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
/// Memastikan transisi satu arah atau bolak-balik berjalan deterministik dan bebas duplikasi entry point.
@Observable
@MainActor
public final class QuickActionDockController {
    public var isExpanded: Bool = false
    public var activeComposer: QuickComposerKind? = nil

    public init() {}

    public func toggleDock(reduceMotion: Bool = false) {
        withAnimation(
            AppTheme.Motion.resolve(
                isExpanded ? AppTheme.Motion.dockCollapse : AppTheme.Motion.dockExpand,
                reduceMotion: reduceMotion
            )
        ) {
            if activeComposer != nil {
                activeComposer = nil
                isExpanded = false
            } else {
                isExpanded.toggle()
            }
        }
    }

    public func performAction(
        _ action: DockAction,
        inboxStore: ActivityInboxStore = .shared,
        reduceMotion: Bool = false
    ) {
        switch action {
        case .create(let kind):
            selectAction(kind, reduceMotion: reduceMotion)
        case .openInbox:
            HapticsHelper.selectionChanged()
            withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.dockCollapse, reduceMotion: reduceMotion)) {
                isExpanded = false
                activeComposer = nil
            }
            inboxStore.dismissActiveFlight(reduceMotion: reduceMotion)
            inboxStore.isPresentingInboxSheet = true
        }
    }

    public func selectAction(_ kind: QuickComposerKind, reduceMotion: Bool = false) {
        HapticsHelper.selectionChanged()
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelMorph, reduceMotion: reduceMotion)) {
            isExpanded = false
            activeComposer = kind
        }
    }

    public func dismissComposer(reduceMotion: Bool = false) {
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelDismiss, reduceMotion: reduceMotion)) {
            activeComposer = nil
            isExpanded = false
        }
    }

    public func resetStateImmediate() {
        isExpanded = false
        activeComposer = nil
    }
}

/// Signature Interaction 01 — TrackerThings Gooey Action Dock.
/// Satu-satunya titik masuk kanonik untuk pembuatan cepat akademik ("Buat Cepat") dan Kotak Aktivitas ("Inbox").
/// Dilengkapi jembatan cair animatable (`GooeyDockBridgeShape`), pengelompokan jelas (Create vs Activity),
/// lencana jumlah belum dibaca yang berdenyut saat item Fly-to-Inbox mendarat, serta pelaporan koordinat nyata.
public struct GooeyActionDock: View {
    @Bindable var controller: QuickActionDockController
    @Bindable var inboxStore: ActivityInboxStore
    var morphNamespace: Namespace.ID
    var hasCourses: Bool

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
            // Backdrop Scrim saat menu terbuka
            if controller.isExpanded {
                Color.black
                    .opacity(colorScheme == .dark ? 0.44 : 0.20)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture {
                        HapticsHelper.impactLight()
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
                if controller.isExpanded {
                    expandedMenuSurface
                        .padding(.bottom, 10)
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .asymmetric(
                                    insertion: .scale(scale: 0.88, anchor: .bottomTrailing)
                                        .combined(with: .opacity)
                                        .combined(with: .offset(y: 16)),
                                    removal: .scale(scale: 0.92, anchor: .bottomTrailing)
                                        .combined(with: .opacity)
                                )
                        )
                }

                // Trigger Button dengan Liquid Metaball Stem & Unread Badge
                ZStack(alignment: .topTrailing) {
                    if !reduceMotion {
                        GooeyDockBridgeShape(progress: controller.isExpanded ? 1.0 : 0.0)
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
                        .scaleEffect(isBadgePulsing ? 1.10 : 1.0)
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
                    if !controller.isExpanded && inboxStore.unreadCount > 0 {
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
            .padding(.bottom, 64)
        }
        .onPreferenceChange(InboxTargetRectPreferenceKey.self) { newRect in
            if newRect != .zero {
                inboxStore.inboxTargetRect = newRect
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

                VStack(spacing: 6) {
                    ForEach(Array(QuickComposerKind.allCases.enumerated()), id: \.element.id) { index, kind in
                        quickCreateRow(for: kind, index: index)
                    }
                }

                Divider()
                    .overlay(AppTheme.Colors.divider)
                    .padding(.vertical, 2)

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
        }
        .buttonStyle(PressableScaleButtonStyle(hapticStyle: nil))
        .animation(
            AppTheme.Motion.menuItemEntrance(index: index, reduceMotion: reduceMotion),
            value: controller.isExpanded
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(kind.title). \(kind.subtitle)")
    }

    // MARK: - Group 2 Row: Academic Activity Inbox

    @ViewBuilder
    private func inboxActionRow(index: Int) -> some View {
        let hasUnread = inboxStore.unreadCount > 0
        let accent = inboxStore.hasUrgentUnread ? AppTheme.Colors.danger : AppTheme.Colors.primary

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
        }
        .buttonStyle(PressableScaleButtonStyle(hapticStyle: nil))
        .animation(
            AppTheme.Motion.menuItemEntrance(index: index, reduceMotion: reduceMotion),
            value: controller.isExpanded
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Kotak Aktivitas Akademik, \(inboxStore.unreadCount) belum dibaca")
        .accessibilityHint("Membuka daftar pengingat tugas, jadwal ujian, dan pembaruan akademik")
    }
}
