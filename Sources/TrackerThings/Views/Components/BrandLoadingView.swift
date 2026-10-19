import SwiftUI

/// Loading view native TrackerThings yang menggunakan visual language dan animasi monogram kanonikal
/// yang sama persis dengan splash screen (I -> T -> Checkmark sekuensial 1.15 detik).
public struct BrandLoadingView: View {
    public let message: String?
    public let size: CGFloat
    public let isFullScreen: Bool
    public let loop: Bool
    public let showWordmark: Bool

    public init(
        message: String? = nil,
        size: CGFloat = 64,
        isFullScreen: Bool = false,
        loop: Bool = true,
        showWordmark: Bool = true
    ) {
        self.message = message
        self.size = size
        self.isFullScreen = isFullScreen
        self.loop = loop
        self.showWordmark = showWordmark
    }

    public var body: some View {
        if isFullScreen {
            ZStack {
                // Background Deep Sapphire Navy Kanonikal dari SplashScreenView (#023075)
                Color(red: 0.008, green: 0.188, blue: 0.459)
                    .ignoresSafeArea()

                contentView(onDark: true)
            }
        } else {
            contentView(onDark: false)
                .padding()
        }
    }

    @ViewBuilder
    private func contentView(onDark: Bool) -> some View {
        VStack(spacing: AppTheme.Metrics.spacingMedium) {
            BrandLogoView(
                size: size,
                cornerRadius: size * 0.24,
                showShadow: true,
                isAnimated: true,
                loop: loop
            )

            if showWordmark {
                BrandWordmarkView(size: max(size * 0.38, 20), onDarkBackground: onDark)
            }

            if let message = message, !message.isEmpty {
                Text(message)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(onDark ? Color.white.opacity(0.85) : AppTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
