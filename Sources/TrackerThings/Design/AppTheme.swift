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

        // MARK: - Backward Compatibility & Semantic Aliases
        public static let brandPrimary = accent
        public static let brandAccent = accent
        public static let primary = accent
        public static let primaryMuted = accentMuted
        public static let background = canvas
        public static let cardBackground = surface
        public static let secondarySurface = surfaceElevated
        public static let tertiarySurface = surface
        public static let elevatedBackground = surfaceElevated
        public static let separator = borderSubtle
        public static let border = borderSubtle
        public static let divider = borderSubtle
        public static let danger = urgent
        public static let dangerMuted = urgentBackground
        public static let warningMuted = warningBackground
        public static let successMuted = successBackground

        // MARK: - Recognizable Academic Course Identity Palette (Restrained Editorial Tones)
        private static let coursePalette: [Color] = [
            Color(lightHex: "#5879B8", darkHex: "#91ADE5"), // Soft Blue (Canonical)
            Color(lightHex: "#4F6D7A", darkHex: "#87A8B8"), // Slate Teal
            Color(lightHex: "#6B639B", darkHex: "#A59ED4"), // Muted Indigo
            Color(lightHex: "#3E7B67", darkHex: "#74B49E"), // Editorial Sage-Teal
            Color(lightHex: "#9E6B43", darkHex: "#D4A27A"), // Warm Ochre
            Color(lightHex: "#8C586C", darkHex: "#C791A6")  // Dusty Plum
        ]

        /// Menghasilkan warna aksen mata kuliah yang konsisten dan tenang berdasarkan nama atau kategori kuliah.
        public static func courseAccent(for identifier: String?) -> Color {
            guard let identifier = identifier else { return accent }
            let trimmed = identifier.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !trimmed.isEmpty else { return accent }
            var hash: UInt64 = 5381
            for byte in trimmed.utf8 {
                hash = ((hash << 5) &+ hash) &+ UInt64(byte)
            }
            let index = Int(hash % UInt64(coursePalette.count))
            return coursePalette[index]
        }

        public static func courseAccentMuted(for identifier: String?) -> Color {
            courseAccent(for: identifier).opacity(0.14)
        }
    }

    // MARK: - Metrics, Spacing & Radii
    public enum Metrics {
        public static let cornerRadiusSmall: CGFloat = 8
        public static let cornerRadiusMedium: CGFloat = 12
        public static let cornerRadiusCard: CGFloat = 14
        public static let cornerRadiusLarge: CGFloat = 18
        public static let cornerRadiusPanel: CGFloat = 24

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

    // MARK: - Motion Design Tokens (Apple HIG & Emil Kowalski Principles)
    public enum Motion {
        /// Durasi animasi UI interaktif cepat (<300ms)
        public static let durationInstant: Double = 0.15
        public static let durationFast: Double = 0.22
        public static let durationStandard: Double = 0.28
        public static let durationDeliberate: Double = 0.40

        /// Spring interaktif untuk respons sentuhan dan tombol: response 0.35s, dampingFraction 0.75
        public static let interactiveSpring: Animation = .spring(response: 0.35, dampingFraction: 0.75, blendDuration: 0)
        /// Spring untuk transisi spasial, navigasi, dan perpindahan elemen: response 0.45s, dampingFraction 0.80
        public static let spatialSpring: Animation = .spring(response: 0.45, dampingFraction: 0.80, blendDuration: 0)
        /// Animasi snappy untuk perubahan tab dan seleksi pill
        public static let snappy: Animation = .snappy(duration: 0.25, extraBounce: 0.05)
        /// Ease-out untuk kemunculan konten (entrances)
        public static let entranceEaseOut: Animation = .easeOut(duration: 0.22)

        // MARK: - Signature Interaction Motion Tokens
        /// Ekspansi Gooey Action Dock (cepat & taktil, selesai <280ms)
        public static let dockExpand: Animation = .spring(response: 0.32, dampingFraction: 0.76, blendDuration: 0)
        /// Penutupan simultan Gooey Action Dock tanpa reverse stagger
        public static let dockCollapse: Animation = .spring(response: 0.24, dampingFraction: 0.88, blendDuration: 0)
        /// Transformasi tombol aksi menjadi Morphing Quick Composer
        public static let panelMorph: Animation = .spring(response: 0.38, dampingFraction: 0.82, blendDuration: 0)
        /// Penutupan Morphing Quick Composer kembali ke asal
        public static let panelDismiss: Animation = .spring(response: 0.26, dampingFraction: 0.88, blendDuration: 0)
        /// Penyelesaian tugas & perpindahan ke koleksi selesai
        public static let taskCompletion: Animation = .spring(response: 0.28, dampingFraction: 0.72, blendDuration: 0)
        /// Kemunculan banner Fly-to-Inbox
        public static let inboxArrival: Animation = .spring(response: 0.36, dampingFraction: 0.80, blendDuration: 0)
        /// Lintasan terbang kartu menuju ikon Inbox
        public static let inboxFlight: Animation = .spring(response: 0.42, dampingFraction: 0.82, blendDuration: 0)
        /// Denyut lencana (badge) saat item mendarat di Inbox
        public static let badgePulse: Animation = .spring(response: 0.28, dampingFraction: 0.68, blendDuration: 0)
        /// Ekspansi detail kontekstual baris tugas/jadwal/kuliah
        public static let inlineExpand: Animation = .spring(response: 0.30, dampingFraction: 0.84, blendDuration: 0)
        /// Fallback halus ketika pengguna mengaktifkan Reduce Motion
        public static let reducedMotionFallback: Animation = .easeOut(duration: 0.18)

        /// Stagger non-uniform (0ms, 35ms, 65ms, 90ms) untuk item menu yang muncul dari Gooey Dock.
        public static func menuItemEntrance(index: Int, reduceMotion: Bool = false) -> Animation {
            if reduceMotion {
                return reducedMotionFallback
            }
            let delays: [Double] = [0.0, 0.035, 0.065, 0.090]
            let delay = index < delays.count ? delays[index] : 0.090
            return .spring(response: 0.34, dampingFraction: 0.78, blendDuration: 0).delay(delay)
        }

        /// Menyesuaikan animasi secara otomatis dengan preferensi `accessibilityReduceMotion`.
        public static func resolve(_ animation: Animation, reduceMotion: Bool) -> Animation {
            reduceMotion ? reducedMotionFallback : animation
        }
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

public struct ElevatedSurfaceModifier: ViewModifier {
    public var cornerRadius: CGFloat = AppTheme.Metrics.cornerRadiusLarge
    public var strokeColor: Color = AppTheme.Colors.borderSubtle
    public var strokeWidth: CGFloat = 1

    public func body(content: Content) -> some View {
        content
            .padding(AppTheme.Metrics.spacingLarge)
            .background(AppTheme.Colors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(strokeColor, lineWidth: strokeWidth)
            )
            .shadow(color: Color.black.opacity(0.08), radius: 14, x: 0, y: 6)
    }
}

public extension View {
    func cardSurface(strokeColor: Color = .clear, strokeWidth: CGFloat = 1) -> some View {
        modifier(CardSurfaceModifier(strokeColor: strokeColor, strokeWidth: strokeWidth))
    }

    func elevatedSurface(
        cornerRadius: CGFloat = AppTheme.Metrics.cornerRadiusLarge,
        strokeColor: Color = AppTheme.Colors.borderSubtle,
        strokeWidth: CGFloat = 1
    ) -> some View {
        modifier(ElevatedSurfaceModifier(cornerRadius: cornerRadius, strokeColor: strokeColor, strokeWidth: strokeWidth))
    }
}

// MARK: - Haptic Feedback Helper
@MainActor
public enum HapticsHelper {
    public static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        #if canImport(UIKit)
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
        #endif
    }

    public static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        #if canImport(UIKit)
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
        #endif
    }

    public static func selection() {
        #if canImport(UIKit)
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
        #endif
    }

    public static func impactLight() {
        impact(.light)
    }

    public static func impactMedium() {
        impact(.medium)
    }

    public static func selectionChanged() {
        selection()
    }

    public static func notificationSuccess() {
        notification(.success)
    }

    public static func notificationWarning() {
        notification(.warning)
    }

    public static func notificationError() {
        notification(.error)
    }
}

// MARK: - Pressable Micro-Interaction Button Style
public struct PressableScaleButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public var scale: CGFloat = 0.97
    public var hapticStyle: UIImpactFeedbackGenerator.FeedbackStyle? = .light

    public init(scale: CGFloat = 0.97, hapticStyle: UIImpactFeedbackGenerator.FeedbackStyle? = .light) {
        self.scale = scale
        self.hapticStyle = hapticStyle
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1.0)
            .opacity(configuration.isPressed && reduceMotion ? 0.85 : 1.0)
            .animation(
                AppTheme.Motion.resolve(AppTheme.Motion.interactiveSpring, reduceMotion: reduceMotion),
                value: configuration.isPressed
            )
            .onChange(of: configuration.isPressed) { _, isPressed in
                if isPressed, let style = hapticStyle {
                    Task { @MainActor in
                        HapticsHelper.impact(style)
                    }
                }
            }
    }
}

public extension ButtonStyle where Self == PressableScaleButtonStyle {
    static var pressableScale: PressableScaleButtonStyle {
        PressableScaleButtonStyle()
    }
}

