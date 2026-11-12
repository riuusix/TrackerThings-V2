import SwiftUI

/// Navigasi bawah native iOS bergaya **Floating Frosted Capsule** ("Frosted Glide").
///
/// Fitur utama:
/// - Seluruh 5 tab kanonis (`Beranda`, `Jadwal`, `Tugas`, `Ujian`, `Profil`) berada di dalam satu kapsul frosted mengambang.
/// - Latar belakang menggunakan `.ultraThinMaterial` dengan tint halus, border specular `1pt`, dan shadow lembut (serta fallback opak saat `accessibilityReduceTransparency` aktif).
/// - Indikator aktif berupa kapsul kaca (`matchedGeometryEffect`) yang meluncur mulus antar tab menggunakan fisika pegas (`AppTheme.Motion.tabGlide`).
/// - Ikon tetap stabil di posisi vertikalnya sementara label tab aktif muncul secara proporsional.
/// - Mendukung haptik seleksi ringan, target sentuh minimal `44×44pt`, VoiceOver traits, dan ketuk ulang tab aktif untuk kembali ke root (`popToRoot`).
public struct FrostedGlideTabBar: View {
    @Binding public var selectedTab: AppTab
    public var activeTaskBadgeCount: Int
    public var onReselectActiveTab: ((AppTab) -> Void)?

    @Namespace private var glideNamespace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorScheme) private var colorScheme

    public init(
        selectedTab: Binding<AppTab>,
        activeTaskBadgeCount: Int = 0,
        onReselectActiveTab: ((AppTab) -> Void)? = nil
    ) {
        self._selectedTab = selectedTab
        self.activeTaskBadgeCount = activeTaskBadgeCount
        self.onReselectActiveTab = onReselectActiveTab
    }

    public var body: some View {
        HStack(spacing: 4) {
            ForEach(AppTab.allCases, id: \.rawValue) { tab in
                tabItemButton(for: tab)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background {
            capsuleSurfaceBackground
        }
        .overlay {
            Capsule(style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(colorScheme == .dark ? 0.22 : 0.72),
                            AppTheme.Colors.borderSubtle.opacity(colorScheme == .dark ? 0.55 : 0.40)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        }
        .shadow(
            color: Color.black.opacity(colorScheme == .dark ? 0.34 : 0.10),
            radius: 18,
            x: 0,
            y: 8
        )
        .padding(.horizontal, AppTheme.Spacing.md)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("FrostedGlideTabBar.container")
    }

    // MARK: - Individual Tab Button

    @ViewBuilder
    private func tabItemButton(for tab: AppTab) -> some View {
        let isSelected = (selectedTab == tab)

        Button {
            handleTabSelection(tab)
        } label: {
            HStack(spacing: isSelected ? 6 : 0) {
                ZStack(alignment: .topTrailing) {
                    Image(systemName: tab.iconName)
                        .font(.system(size: 15, weight: isSelected ? .bold : .semibold))
                        .symbolEffect(.bounce.down, value: isSelected && !reduceMotion)
                        .frame(width: 20, height: 20)

                    if tab == .tasks && activeTaskBadgeCount > 0 && !isSelected {
                        Circle()
                            .fill(AppTheme.Colors.brandAccent)
                            .frame(width: 6, height: 6)
                            .offset(x: 3, y: -2)
                            .accessibilityHidden(true)
                    }
                }

                if isSelected {
                    Text(tab.shortLabel)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .opacity.combined(with: .scale(scale: 0.9, anchor: .leading))
                        )
                }
            }
            .foregroundStyle(
                isSelected
                    ? AppTheme.Colors.brandPrimary
                    : AppTheme.Colors.textSecondary
            )
            .padding(.horizontal, isSelected ? 13 : 10)
            .frame(minWidth: 44, minHeight: 44)
            .frame(maxWidth: isSelected ? .infinity : nil)
            .contentShape(Capsule(style: .continuous))
            .background {
                if isSelected {
                    activeGlidePill
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(tab.accessibilityIdentifier)
        .accessibilityLabel(accessibilityLabel(for: tab))
        .accessibilityHint(isSelected ? "Tab sedang aktif. Ketuk dua kali untuk kembali ke atas." : "Beralih ke tab \(tab.title)")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : [.isButton])
    }

    // MARK: - Sliding Active Pill & Frosted Surface

    @ViewBuilder
    private var activeGlidePill: some View {
        ZStack {
            if reduceTransparency {
                Capsule(style: .continuous)
                    .fill(AppTheme.Colors.brandPrimary.opacity(colorScheme == .dark ? 0.24 : 0.14))
            } else {
                Capsule(style: .continuous)
                    .fill(.thinMaterial)
                    .overlay {
                        Capsule(style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        AppTheme.Colors.brandPrimary.opacity(colorScheme == .dark ? 0.26 : 0.15),
                                        AppTheme.Colors.brandSecondary.opacity(colorScheme == .dark ? 0.14 : 0.08)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
            }
        }
        .overlay {
            Capsule(style: .continuous)
                .strokeBorder(
                    AppTheme.Colors.brandPrimary.opacity(colorScheme == .dark ? 0.42 : 0.26),
                    lineWidth: 1
                )
        }
        .shadow(
            color: AppTheme.Colors.brandPrimary.opacity(colorScheme == .dark ? 0.20 : 0.12),
            radius: 8,
            x: 0,
            y: 3
        )
        .matchedGeometryEffect(id: "frostedGlideActivePill", in: glideNamespace)
    }

    @ViewBuilder
    private var capsuleSurfaceBackground: some View {
        if reduceTransparency {
            Capsule(style: .continuous)
                .fill(AppTheme.Colors.surfaceElevated)
        } else {
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay {
                    Capsule(style: .continuous)
                        .fill(
                            colorScheme == .dark
                                ? Color.black.opacity(0.22)
                                : Color.white.opacity(0.42)
                        )
                }
        }
    }

    // MARK: - Actions & Helpers

    private func handleTabSelection(_ tab: AppTab) {
        if selectedTab == tab {
            HapticsHelper.lightImpact()
            onReselectActiveTab?(tab)
            return
        }

        HapticsHelper.selectionChanged()
        let animation = AppTheme.Motion.resolved(AppTheme.Motion.tabGlide, reduceMotion: reduceMotion)
            ?? .linear(duration: 0.01)
        withAnimation(animation) {
            selectedTab = tab
        }
    }

    private func accessibilityLabel(for tab: AppTab) -> String {
        if tab == .tasks && activeTaskBadgeCount > 0 {
            return "\(tab.title), \(activeTaskBadgeCount) tugas aktif"
        }
        return tab.title
    }
}

