import SwiftUI

/// Tombol header Inbox Akademik ("Kotak Aktivitas") dengan badge counter animasi `.numericText()`
/// dan efek denyut (pulse) saat item baru mendarat dari animasi Fly-to-Inbox.
public struct InboxPillButton: View {
    @Bindable var store: ActivityInboxStore = .shared
    @State private var isPulsing: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(store: ActivityInboxStore = .shared) {
        self.store = store
    }

    public var body: some View {
        Button {
            HapticsHelper.impactLight()
            store.isPresentingInboxSheet = true
        } label: {
            HStack(spacing: 6) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: store.unreadCount > 0 ? "tray.full.fill" : "tray")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(store.unreadCount > 0 ? AppTheme.Colors.primary : AppTheme.Colors.textSecondary)

                    if store.hasUrgentUnread {
                        Circle()
                            .fill(AppTheme.Colors.danger)
                            .frame(width: 6, height: 6)
                            .offset(x: 3, y: -2)
                    }
                }

                if store.unreadCount > 0 {
                    Text("\(store.unreadCount)")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(AppTheme.Colors.primary)
                        .contentTransition(.numericText())
                } else {
                    Text("Inbox")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(store.unreadCount > 0 ? AppTheme.Colors.primaryMuted : AppTheme.Colors.secondarySurface)
            )
            .overlay(
                Capsule()
                    .strokeBorder(
                        store.unreadCount > 0 ? AppTheme.Colors.primary.opacity(0.32) : AppTheme.Colors.border,
                        lineWidth: 1
                    )
            )
            .scaleEffect(isPulsing ? 1.14 : 1.0)
        }
        .buttonStyle(PressableScaleButtonStyle())
        .onChange(of: store.badgePulseTrigger) { _, _ in
            guard !reduceMotion else { return }
            withAnimation(AppTheme.Motion.badgePulse) {
                isPulsing = true
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 220_000_000)
                withAnimation(AppTheme.Motion.badgePulse) {
                    isPulsing = false
                }
            }
        }
        .accessibilityLabel("Kotak Aktivitas Akademik, \(store.unreadCount) belum dibaca")
        .accessibilityHint("Ketuk untuk melihat pengingat dan pembaruan akademik")
    }
}

/// Signature Interaction 03 — Fly-to-Inbox Overlay.
/// Menampilkan kartu pratinjau kontekstual saat pengingat atau item baru tiba, menahan sejenak agar terbaca,
/// lalu melengkung masuk (fly-to-inbox) ke arah tombol Inbox di sudut kanan atas.
public struct FlyToInboxOverlay: View {
    @Bindable var store: ActivityInboxStore = .shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    public init(store: ActivityInboxStore = .shared) {
        self.store = store
    }

    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                if let item = store.activeFlightItem, store.flightPhase != .idle {
                    flightCard(for: item, containerWidth: proxy.size.width)
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .scaleEffect(flightScale, anchor: .topTrailing)
                        .offset(x: flightOffsetX(width: proxy.size.width), y: flightOffsetY)
                        .opacity(flightOpacity)
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
        .allowsHitTesting(store.activeFlightItem != nil && store.flightPhase == .holding)
    }

    private var flightScale: CGFloat {
        if reduceMotion { return 1.0 }
        switch store.flightPhase {
        case .idle:
            return 0.94
        case .entering, .holding:
            return 1.0
        case .flyingToInbox, .landed:
            return 0.24
        }
    }

    private func flightOffsetX(width: CGFloat) -> CGFloat {
        if reduceMotion { return 0 }
        switch store.flightPhase {
        case .idle, .entering, .holding:
            return 0
        case .flyingToInbox, .landed:
            return max(80, (width * 0.28))
        }
    }

    private var flightOffsetY: CGFloat {
        if reduceMotion { return 0 }
        switch store.flightPhase {
        case .idle:
            return -18
        case .entering, .holding:
            return 0
        case .flyingToInbox, .landed:
            return -14
        }
    }

    private var flightOpacity: Double {
        switch store.flightPhase {
        case .idle, .landed:
            return 0
        case .entering, .holding:
            return 1
        case .flyingToInbox:
            return reduceMotion ? 0 : 0.12
        }
    }

    @ViewBuilder
    private func flightCard(for item: NotificationItem, containerWidth: CGFloat) -> some View {
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
                store.dismissActiveFlight(reduceMotion: reduceMotion)
            } label: {
                Image(systemName: "arrow.up.right.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(AppTheme.Colors.textTertiary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Simpan ke Inbox")
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
        .accessibilityHint("Ketuk untuk membuka detail atau tunggu hingga tersimpan ke Inbox")
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
