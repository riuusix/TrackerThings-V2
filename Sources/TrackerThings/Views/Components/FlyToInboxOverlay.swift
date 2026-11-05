import SwiftUI

/// PreferenceKey untuk membaca koordinat awal kartu pratinjau Fly-to-Inbox dalam ruang koordinat root aplikasi.
private struct FlightSourceRectPreferenceKey: PreferenceKey {
    nonisolated(unsafe) static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        let candidate = nextValue()
        if candidate != .zero {
            value = candidate
        }
    }
}

/// Modifier animatable yang menggerakkan kartu pratinjau notifikasi sepanjang kurva Bézier kuadratik
/// dari posisi banner terukur langsung menuju titik tengah target Inbox (`GooeyActionDock`).
public struct AnchoredFlightModifier: ViewModifier, Animatable {
    public var progress: CGFloat
    public var deltaX: CGFloat
    public var deltaY: CGFloat
    public var reduceMotion: Bool

    public var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    public init(
        progress: CGFloat,
        deltaX: CGFloat,
        deltaY: CGFloat,
        reduceMotion: Bool
    ) {
        self.progress = progress
        self.deltaX = deltaX
        self.deltaY = deltaY
        self.reduceMotion = reduceMotion
    }

    /// Menghitung posisi $(x, y)$ sepanjang lintasan lengkung Bézier kuadratik untuk nilai $t \in [0, 1]$.
    public nonisolated static func pointOnQuadraticBezier(
        t: CGFloat,
        deltaX: CGFloat,
        deltaY: CGFloat
    ) -> CGPoint {
        let clamped = max(0, min(1, t))
        let oneMinusT = 1 - clamped
        // Titik kontrol melengkung halus ke arah dalam/atas sebelum menukik tepat ke target dock kanan bawah
        let controlX = deltaX * 0.72
        let controlY = min(-28, deltaY * 0.16)

        let x = (2 * oneMinusT * clamped * controlX) + (clamped * clamped * deltaX)
        let y = (2 * oneMinusT * clamped * controlY) + (clamped * clamped * deltaY)
        return CGPoint(x: x, y: y)
    }

    public func body(content: Content) -> some View {
        let clamped = max(0, min(1, progress))
        let curvePoint = reduceMotion
            ? .zero
            : Self.pointOnQuadraticBezier(t: clamped, deltaX: deltaX, deltaY: deltaY)
        let currentScale: CGFloat = reduceMotion ? 1.0 : (1.0 - (0.78 * clamped))
        let currentOpacity: Double = reduceMotion
            ? Double(1.0 - clamped)
            : Double(max(0, 1.0 - pow(clamped, 1.85)))

        content
            .scaleEffect(currentScale, anchor: .center)
            .offset(x: curvePoint.x, y: curvePoint.y)
            .opacity(currentOpacity)
    }
}

/// Signature Interaction 03 — True Anchored Fly-to-Inbox Overlay.
/// Menampilkan kartu pratinjau kontekstual saat pengingat atau item baru tiba, menahan sejenak agar terbaca,
/// lalu melengkung sepanjang kurva Bézier kuadratik langsung ke koordinat nyata `GooeyActionDock` (Inbox).
public struct FlyToInboxOverlay: View {
    @Bindable var store: ActivityInboxStore = .shared
    @State private var sourceRect: CGRect = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase

    public init(store: ActivityInboxStore = .shared) {
        self.store = store
    }

    public var body: some View {
        GeometryReader { proxy in
            let targetCenter = resolvedTargetCenter(in: proxy.size)
            let originCenter = resolvedSourceCenter(in: proxy.size)
            let dx = targetCenter.x - originCenter.x
            let dy = targetCenter.y - originCenter.y

            ZStack(alignment: .top) {
                if let item = store.activeFlightItem, store.flightPhase != .idle {
                    flightCard(for: item)
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .background(
                            GeometryReader { cardGeo in
                                Color.clear.preference(
                                    key: FlightSourceRectPreferenceKey.self,
                                    value: cardGeo.frame(in: .named("RootInteractiveSpace"))
                                )
                            }
                        )
                        .modifier(
                            AnchoredFlightModifier(
                                progress: store.flightProgress,
                                deltaX: dx,
                                deltaY: dy,
                                reduceMotion: reduceMotion
                            )
                        )
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .asymmetric(
                                    insertion: .move(edge: .top).combined(with: .opacity).combined(with: .scale(scale: 0.95)),
                                    removal: .opacity
                                )
                        )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .allowsHitTesting(store.activeFlightItem != nil && (store.flightPhase == .entering || store.flightPhase == .holding))
        .onPreferenceChange(FlightSourceRectPreferenceKey.self) { rect in
            if rect != .zero {
                sourceRect = rect
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase != .active && store.flightPhase != .idle {
                store.dismissActiveFlight(reduceMotion: true)
            }
        }
        .onDisappear {
            if store.flightPhase != .idle {
                store.dismissActiveFlight(reduceMotion: true)
            }
        }
    }

    /// Menentukan titik pusat tujuan nyata dari `store.inboxTargetRect` yang diukur dari `GooeyActionDock`.
    /// Menyediakan fallback deterministik ke sudut kanan bawah dock apabila layout belum selesai diukur.
    private func resolvedTargetCenter(in containerSize: CGSize) -> CGPoint {
        let measured = store.inboxTargetRect
        if measured.width > 0 && measured.height > 0 {
            return CGPoint(x: measured.midX, y: measured.midY)
        }
        return CGPoint(
            x: max(48, containerSize.width - 48),
            y: max(92, containerSize.height - 92)
        )
    }

    /// Menentukan titik pusat awal kartu pratinjau notifikasi dalam ruang koordinat root.
    private func resolvedSourceCenter(in containerSize: CGSize) -> CGPoint {
        if sourceRect.width > 0 && sourceRect.height > 0 {
            return CGPoint(x: sourceRect.midX, y: sourceRect.midY)
        }
        return CGPoint(x: containerSize.width * 0.5, y: 44)
    }

    @ViewBuilder
    private func flightCard(for item: NotificationItem) -> some View {
        let accent = accentColor(for: item)

        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(accent.opacity(0.16))
                    .frame(width: 40, height: 40)

                Image(systemName: item.tipe.iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(accent)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(categoryLabel(for: item.tipe))
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .tracking(0.6)
                        .foregroundStyle(accent)

                    Text("•")
                        .font(.caption2)
                        .foregroundStyle(AppTheme.Colors.textTertiary)

                    Text(item.waktu)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .lineLimit(1)
                }

                Text(item.judul)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                    .lineLimit(1)

                Text(item.namaMatkul)
                    .font(.caption)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            Button {
                HapticsHelper.impactLight()
                store.dismissActiveFlight(reduceMotion: reduceMotion)
            } label: {
                Image(systemName: "arrow.down.right.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(AppTheme.Colors.textTertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Simpan ke Kotak Aktivitas")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(AppTheme.Colors.secondarySurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(accent.opacity(0.32), lineWidth: 1)
        )
        .shadow(
            color: Color.black.opacity(colorScheme == .dark ? 0.42 : 0.14),
            radius: 18,
            x: 0,
            y: 8
        )
        .contentShape(Rectangle())
        .onTapGesture {
            HapticsHelper.impactLight()
            store.openItem(item)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pembaruan baru: \(item.judul), \(item.namaMatkul), \(item.waktu)")
        .accessibilityHint("Ketuk untuk membuka detail atau tunggu hingga tersimpan ke Kotak Aktivitas")
    }

    private func accentColor(for item: NotificationItem) -> Color {
        if item.isUrgent {
            return AppTheme.Colors.danger
        }
        switch item.tipe {
        case .tugas:
            return AppTheme.Colors.primary
        case .ujian:
            return AppTheme.Colors.danger
        case .kuliah:
            return AppTheme.Colors.success
        case .pengganti:
            return AppTheme.Colors.warning
        }
    }

    private func categoryLabel(for tipe: NotificationItem.TipeNotifikasi) -> String {
        switch tipe {
        case .tugas: return "TUGAS"
        case .ujian: return "UJIAN"
        case .kuliah: return "KULIAH"
        case .pengganti: return "PENGGANTI"
        }
    }
}
