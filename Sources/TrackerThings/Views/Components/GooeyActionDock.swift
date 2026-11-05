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

/// Pengendali state untuk Gooey Action Dock & Morphing Quick Composer.
/// Memastikan transisi satu arah atau bolak-balik berjalan deterministik dan mudah diuji.
@Observable
@MainActor
public final class QuickActionDockController {
    public var isExpanded: Bool = false
    public var activeComposer: QuickComposerKind? = nil

    public init() {}

    public func toggleDock(reduceMotion: Bool = false) {
        HapticsHelper.impactLight()
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

    public func selectAction(_ kind: QuickComposerKind, reduceMotion: Bool = false) {
        HapticsHelper.selectionChanged()
        withAnimation(AppTheme.Motion.resolve(AppTheme.Motion.panelMorph, reduceMotion: reduceMotion)) {
            isExpanded = false
            activeComposer = kind
        }
    }

    public func dismissComposer(reduceMotion: Bool = false) {
        HapticsHelper.impactLight()
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
/// Menampilkan tombol aksi mengambang (`+`) di atas tab bar dengan efek jembatan cair (metaball/gooey bridge)
/// saat membuka menu pembuatan cepat akademik, serta mendukung morphing langsung ke `MorphingQuickComposer`.
public struct GooeyActionDock: View {
    @Bindable var controller: QuickActionDockController
    var morphNamespace: Namespace.ID
    var hasCourses: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    public init(
        controller: QuickActionDockController,
        morphNamespace: Namespace.ID,
        hasCourses: Bool
    ) {
        self.controller = controller
        self.morphNamespace = morphNamespace
        self.hasCourses = hasCourses
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            // Backdrop Scrim saat menu terbuka
            if controller.isExpanded {
                Color.black
                    .opacity(colorScheme == .dark ? 0.42 : 0.18)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .onTapGesture {
                        controller.toggleDock(reduceMotion: reduceMotion)
                    }
                    .accessibilityLabel("Tutup menu tambah cepat")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction(.escape) {
                        controller.toggleDock(reduceMotion: reduceMotion)
                    }
            }

            // Stack Aksi + Trigger Utama
            VStack(alignment: .trailing, spacing: 12) {
                if controller.isExpanded {
                    VStack(alignment: .trailing, spacing: 10) {
                        ForEach(Array(QuickComposerKind.allCases.enumerated()), id: \.element.id) { index, kind in
                            actionMenuPill(for: kind, index: index)
                        }
                    }
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .asymmetric(
                                insertion: .scale(scale: 0.92, anchor: .bottomTrailing)
                                    .combined(with: .opacity)
                                    .combined(with: .offset(y: 14)),
                                removal: .scale(scale: 0.94, anchor: .bottomTrailing)
                                    .combined(with: .opacity)
                            )
                    )
                }

                // Trigger Button dengan Gooey Metaball Bridge
                ZStack {
                    if !reduceMotion {
                        gooeyMetaballBridge
                            .frame(width: 84, height: controller.isExpanded ? 116 : 64)
                            .offset(y: controller.isExpanded ? -24 : 0)
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
                                            AppTheme.Colors.primary.opacity(0.88)
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 56, height: 56)
                                .overlay(
                                    Circle()
                                        .strokeBorder(Color.white.opacity(0.24), lineWidth: 1)
                                )
                                .shadow(
                                    color: AppTheme.Colors.primary.opacity(colorScheme == .dark ? 0.38 : 0.28),
                                    radius: controller.isExpanded ? 18 : 12,
                                    x: 0,
                                    y: 6
                                )

                            Image(systemName: "plus")
                                .font(.system(size: 21, weight: .bold, design: .rounded))
                                .foregroundStyle(.white)
                                .rotationEffect(.degrees(controller.isExpanded ? 45 : 0))
                        }
                    }
                    .buttonStyle(PressableScaleButtonStyle())
                    .accessibilityLabel(controller.isExpanded ? "Tutup menu aksi cepat" : "Tambah item akademik baru")
                    .accessibilityHint("Membuka pilihan tambah tugas, kelas pengganti, mata kuliah, atau jadwal ujian")
                    .accessibilityAction(.escape) {
                        if controller.isExpanded {
                            controller.toggleDock(reduceMotion: reduceMotion)
                        }
                    }
                }
            }
            .padding(.trailing, 20)
            .padding(.bottom, 64)
        }
    }

    // MARK: - Gooey Metaball Liquid Bridge

    private var gooeyMetaballBridge: some View {
        Canvas { context, size in
            context.addFilter(.alphaThreshold(min: 0.48, color: AppTheme.Colors.primary.opacity(0.92)))
            context.addFilter(.blur(radius: 10))

            context.drawLayer { layer in
                let baseCenter = CGPoint(x: size.width / 2, y: size.height - 28)
                let baseRect = CGRect(x: baseCenter.x - 27, y: baseCenter.y - 27, width: 54, height: 54)
                layer.fill(Path(ellipseIn: baseRect), with: .color(.white))

                if controller.isExpanded {
                    let bridgeRect = CGRect(
                        x: baseCenter.x - 16,
                        y: baseCenter.y - 62,
                        width: 32,
                        height: 48
                    )
                    layer.fill(
                        Path(roundedRect: bridgeRect, cornerRadius: 16),
                        with: .color(.white)
                    )

                    let topDropRect = CGRect(
                        x: baseCenter.x - 20,
                        y: baseCenter.y - 78,
                        width: 40,
                        height: 28
                    )
                    layer.fill(Path(ellipseIn: topDropRect), with: .color(.white))
                }
            }
        }
    }

    // MARK: - Action Menu Pill

    @ViewBuilder
    private func actionMenuPill(for kind: QuickComposerKind, index: Int) -> some View {
        let isDisabledByMissingCourse = !hasCourses && (kind == .task || kind == .replacement || kind == .exam)

        Button {
            if isDisabledByMissingCourse {
                // Jika belum ada mata kuliah, arahkan langsung ke pembuatan Mata Kuliah Baru
                controller.selectAction(.course, reduceMotion: reduceMotion)
            } else {
                controller.selectAction(kind, reduceMotion: reduceMotion)
            }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(kind.title)
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(AppTheme.Colors.textPrimary)

                    Text(isDisabledByMissingCourse ? "Buat mata kuliah terlebih dahulu" : kind.subtitle)
                        .font(.caption2)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .lineLimit(1)
                }

                ZStack {
                    Circle()
                        .fill(kind.accentColor.opacity(0.15))
                        .frame(width: 40, height: 40)

                    Image(systemName: kind.iconName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(kind.accentColor)
                }
            }
            .padding(.leading, 16)
            .padding(.trailing, 10)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(AppTheme.Colors.secondarySurface)
                    .matchedGeometryEffect(id: "composer-surface-\(kind.rawValue)", in: morphNamespace)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(kind.accentColor.opacity(0.24), lineWidth: 1)
            )
            .shadow(
                color: Color.black.opacity(colorScheme == .dark ? 0.32 : 0.10),
                radius: 12,
                x: 0,
                y: 5
            )
        }
        .buttonStyle(PressableScaleButtonStyle())
        .animation(
            AppTheme.Motion.menuItemEntrance(index: index, reduceMotion: reduceMotion),
            value: controller.isExpanded
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(kind.title). \(kind.subtitle)")
    }
}
