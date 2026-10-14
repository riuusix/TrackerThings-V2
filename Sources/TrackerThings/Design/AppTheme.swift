import SwiftUI

/// Semantic Design System Tokens for TrackerThings V2
/// Enforces consistent Apple Human Interface Guidelines, cohesive light/dark mode adaptation,
/// restrained academic visual hierarchy, and 44x44pt accessibility touch targets.
public enum AppTheme {
    // MARK: - Semantic Colors
    public enum Colors {
        /// Brand Primary: Deep Royal Blue matching canonical logo backdrop
        public static let brandPrimary = Color(red: 0.043, green: 0.224, blue: 0.588) // #0B3996
        public static let brandAccent = Color(red: 0.05, green: 0.60, blue: 0.95)

        /// Backgrounds & Surfaces
        public static let background = Color(uiColor: .systemGroupedBackground)
        public static let cardBackground = Color(uiColor: .secondarySystemGroupedBackground)
        public static let elevatedBackground = Color(uiColor: .tertiarySystemGroupedBackground)

        /// Content Text
        public static let textPrimary = Color(uiColor: .label)
        public static let textSecondary = Color(uiColor: .secondaryLabel)
        public static let textTertiary = Color(uiColor: .tertiaryLabel)

        /// Semantic Status Badges & Alerts
        public static let success = Color.green
        public static let warning = Color.orange
        public static let urgent = Color.red
        public static let info = Color.blue

        /// Status Tint Backgrounds (Restrained 10-15% opacity)
        public static let successBackground = Color.green.opacity(0.12)
        public static let warningBackground = Color.orange.opacity(0.12)
        public static let urgentBackground = Color.red.opacity(0.12)
        public static let infoBackground = Color.blue.opacity(0.12)
        public static let neutralBackground = Color(uiColor: .tertiarySystemFill)

        /// Dividers & Borders
        public static let separator = Color(uiColor: .separator)
    }

    // MARK: - Metrics, Spacing & Radii
    public enum Metrics {
        public static let cornerRadiusSmall: CGFloat = 8
        public static let cornerRadiusMedium: CGFloat = 12
        public static let cornerRadiusCard: CGFloat = 14
        public static let cornerRadiusLarge: CGFloat = 18

        public static let spacingXXSmall: CGFloat = 4
        public static let spacingXSmall: CGFloat = 6
        public static let spacingSmall: CGFloat = 8
        public static let spacingMedium: CGFloat = 12
        public static let spacingLarge: CGFloat = 16
        public static let spacingXLarge: CGFloat = 20
        public static let spacingSection: CGFloat = 24

        public static let cardPadding: CGFloat = 14
        public static let minTouchTarget: CGFloat = 44
    }

    // MARK: - Typography Presets
    public enum Typography {
        public static let largeTitle = Font.system(.largeTitle, design: .rounded, weight: .bold)
        public static let pageTitle = Font.title2.weight(.bold)
        public static let sectionHeader = Font.headline.weight(.semibold)
        public static let cardTitle = Font.subheadline.weight(.semibold)
        public static let body = Font.body
        public static let secondary = Font.subheadline
        public static let caption = Font.caption
        public static let captionBold = Font.caption.weight(.semibold)
        public static let badge = Font.caption2.weight(.bold)
    }
}

// MARK: - View Modifiers & Reusable Styles

public struct CardSurfaceModifier: ViewModifier {
    public var strokeColor: Color = Color.clear
    public var strokeWidth: CGFloat = 1

    public func body(content: Content) -> some View {
        content
            .padding(AppTheme.Metrics.cardPadding)
            .background(AppTheme.Colors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusCard, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusCard, style: .continuous)
                    .stroke(strokeColor, lineWidth: strokeWidth)
            )
            .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 2)
    }
}

public extension View {
    func cardSurface(strokeColor: Color = .clear, strokeWidth: CGFloat = 1) -> some View {
        modifier(CardSurfaceModifier(strokeColor: strokeColor, strokeWidth: strokeWidth))
    }
}

