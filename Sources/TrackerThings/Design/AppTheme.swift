import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Hex & Dynamic Adaptive Color Initializers

public extension Color {
    init(hex: String) {
        let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var hexNumber: UInt64 = 0
        if Scanner(string: cleanHex).scanHexInt64(&hexNumber) {
            let r = Double((hexNumber & 0xff0000) >> 16) / 255.0
            let g = Double((hexNumber & 0x00ff00) >> 8) / 255.0
            let b = Double(hexNumber & 0x0000ff) / 255.0
            self.init(red: r, green: g, blue: b)
            return
        }
        self.init(.clear)
    }

    init(lightHex: String, darkHex: String) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traitCollection in
            let chosenHex = traitCollection.userInterfaceStyle == .dark ? darkHex : lightHex
            let cleanHex = chosenHex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
            var hexNumber: UInt64 = 0
            if Scanner(string: cleanHex).scanHexInt64(&hexNumber) {
                let r = CGFloat((hexNumber & 0xff0000) >> 16) / 255.0
                let g = CGFloat((hexNumber & 0x00ff00) >> 8) / 255.0
                let b = CGFloat(hexNumber & 0x0000ff) / 255.0
                return UIColor(red: r, green: g, blue: b, alpha: 1.0)
            }
            return .clear
        })
        #else
        self.init(hex: lightHex)
        #endif
    }
}

/// Semantic Design System Tokens for TrackerThings V2 (iOS Native)
/// Aligned with the canonical Soft Blue design system:
/// - Editorial Distinctive, Soft Contrast, Intentional Hierarchy
/// - Canvas: Light #F1F2F5, Dark #242831
/// - Surface: Light #E6E9EF, Dark #2D323D
/// - Elevated Surface: Light #FFFFFF, Dark #373E4B
/// - Primary Accent: Light #5879B8, Dark #91ADE5
/// - Text: Light #343944 / Dark #E7EAF0 (Primary), Light #6B7280 / Dark #B2BAC8 (Secondary)
/// - Borders: Light #D5DCE8 / Dark #454D5C (Subtle), Light #B8C3D5 / Dark #626D80 (Strong)
public enum AppTheme {
    // MARK: - Semantic Colors
    public enum Colors {
        // MARK: - Canvases & Surfaces (Soft Blue / Slate Palette)
        /// Canvas / Background: Light #F1F2F5, Dark #242831
        public static let canvas = Color(lightHex: "#F1F2F5", darkHex: "#242831")
        /// Surface (Cards): Light #E6E9EF, Dark #2D323D
        public static let surface = Color(lightHex: "#E6E9EF", darkHex: "#2D323D")
        /// Elevated Surface (Modals, Dropdowns, Float Cards): Light #FFFFFF, Dark #373E4B
        public static let surfaceElevated = Color(lightHex: "#FFFFFF", darkHex: "#373E4B")

        // MARK: - Content & Typography
        /// Primary Text: Light #343944, Dark #E7EAF0
        public static let textPrimary = Color(lightHex: "#343944", darkHex: "#E7EAF0")
        /// Secondary Text: Light #6B7280, Dark #B2BAC8
        public static let textSecondary = Color(lightHex: "#6B7280", darkHex: "#B2BAC8")
        /// Tertiary / Muted Text: Light #8C95A6, Dark #8C95A6
        public static let textTertiary = Color(lightHex: "#8C95A6", darkHex: "#8C95A6")

        // MARK: - Accent (Soft Blue Tone)
        /// Canonical Accent: Light #5879B8, Dark #91ADE5
        public static let accent = Color(lightHex: "#5879B8", darkHex: "#91ADE5")
        /// Pressed / Hover Accent: Light #3F5F9B, Dark #B0C5F1
        public static let accentPressed = Color(lightHex: "#3F5F9B", darkHex: "#B0C5F1")
        /// Muted Accent Background: Light #E5ECF8, Dark #303D55
        public static let accentMuted = Color(lightHex: "#E5ECF8", darkHex: "#303D55")

        // MARK: - Borders & Separators
        /// Subtle Border: Light #D5DCE8, Dark #454D5C
        public static let borderSubtle = Color(lightHex: "#D5DCE8", darkHex: "#454D5C")
        /// Strong Border: Light #B8C3D5, Dark #626D80
        public static let borderStrong = Color(lightHex: "#B8C3D5", darkHex: "#626D80")

        // MARK: - Semantic Status Badges & Alerts
        public static let success = Color(lightHex: "#10B981", darkHex: "#10B981")
        public static let warning = Color(lightHex: "#F59E0B", darkHex: "#F59E0B")
        public static let urgent = Color(lightHex: "#EF4444", darkHex: "#EF4444")
        public static let info = Color(lightHex: "#5879B8", darkHex: "#91ADE5")

        // MARK: - Status Background Tints (Restrained)
        public static let successBackground = Color(lightHex: "#ECFDF5", darkHex: "#064E3B").opacity(0.85)
        public static let warningBackground = Color(lightHex: "#FFFBEB", darkHex: "#78350F").opacity(0.85)
        public static let urgentBackground = Color(lightHex: "#FEF2F2", darkHex: "#7F1D1D").opacity(0.85)
        public static let infoBackground = Color(lightHex: "#E5ECF8", darkHex: "#303D55")
        public static let neutralBackground = Color(lightHex: "#E6E9EF", darkHex: "#2D323D")

        // MARK: - Backward Compatibility Aliases
        public static let brandPrimary = accent
        public static let brandAccent = accent
        public static let background = canvas
        public static let cardBackground = surface
        public static let elevatedBackground = surfaceElevated
        public static let separator = borderSubtle
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

