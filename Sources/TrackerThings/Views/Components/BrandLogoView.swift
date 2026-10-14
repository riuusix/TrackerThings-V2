import SwiftUI
import UIKit

/// Monogram Logo Geometris Kanonikal TrackerThings.
/// Mengikuti siluet referensi resmi (media_1792004406941_078456aa.webp):
/// - Palang horizontal T dengan potongan terminal diagonal 45° di kanan atas.
/// - Sayap centang dinamis yang menyatu secara mulus dengan dasar batang stem tanpa ekor menggantung.
/// - Pertemuan sisi dalam sayap centang pada titik koordinat presisi (Y ≈ 0.552).
public struct BrandLogoMarkView: View {
    public let stemProgress: CGFloat
    public let crossbarProgress: CGFloat
    public let checkmarkProgress: CGFloat

    public init(
        stemProgress: CGFloat = 1.0,
        crossbarProgress: CGFloat = 1.0,
        checkmarkProgress: CGFloat = 1.0
    ) {
        self.stemProgress = stemProgress
        self.crossbarProgress = crossbarProgress
        self.checkmarkProgress = checkmarkProgress
    }

    public var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height

            // Landmark geometris terkalibrasi langsung dari gambar referensi kanonikal
            let topY = h * 0.2646
            let cbBotY = h * 0.3535
            let cbLeft = w * 0.2520
            let cbRightTop = w * 0.7441
            let cbRightBot = w * 0.6689

            let stemLeft = w * 0.3984
            let stemRight = w * 0.4912
            let stemJoinY = h * 0.5518
            let stemBottomY = h * 0.7334
            let bottomApexX = w * 0.4500

            let cmTopY = h * 0.4033
            let cmInnerX = w * 0.6113
            let cmOuterX = w * 0.7227

            let rCorner = w * 0.010
            let rStemBottom = w * 0.024

            ZStack {
                // 1. Batang Vertikal "I" (Fase 1: Muncul pertama kali)
                if stemProgress > 0 {
                    Path { path in
                        let currentBottomY = topY + (stemBottomY - topY) * stemProgress

                        path.move(to: CGPoint(x: stemLeft, y: topY))
                        path.addLine(to: CGPoint(x: stemRight, y: topY))
                        path.addLine(to: CGPoint(x: stemRight, y: max(topY, currentBottomY - rStemBottom)))
                        path.addQuadCurve(
                            to: CGPoint(x: (stemLeft + stemRight) / 2, y: currentBottomY),
                            control: CGPoint(x: stemRight, y: currentBottomY)
                        )
                        path.addQuadCurve(
                            to: CGPoint(x: stemLeft, y: max(topY, currentBottomY - rStemBottom)),
                            control: CGPoint(x: stemLeft, y: currentBottomY)
                        )
                        path.closeSubpath()
                    }
                    .fill(Color.white)
                }

                // 2. Palang Horizontal "I -> T" (Fase 2: Berkembang ke kiri & kanan dengan terminal diagonal)
                if crossbarProgress > 0 {
                    Path { path in
                        let currentLeft = stemLeft - (stemLeft - cbLeft) * crossbarProgress
                        let currentRightTop = stemRight + (cbRightTop - stemRight) * crossbarProgress
                        let currentRightBot = stemRight + (cbRightBot - stemRight) * crossbarProgress

                        path.move(to: CGPoint(x: currentLeft + rCorner, y: topY))
                        path.addLine(to: CGPoint(x: currentRightTop, y: topY))
                        // Terminal diagonal di ujung kanan palang atas
                        path.addLine(to: CGPoint(x: currentRightBot, y: cbBotY))
                        path.addLine(to: CGPoint(x: currentLeft + rCorner, y: cbBotY))
                        path.addArc(
                            tangent1End: CGPoint(x: currentLeft, y: cbBotY),
                            tangent2End: CGPoint(x: currentLeft, y: topY),
                            radius: rCorner
                        )
                        path.addLine(to: CGPoint(x: currentLeft, y: topY + rCorner))
                        path.addArc(
                            tangent1End: CGPoint(x: currentLeft, y: topY),
                            tangent2End: CGPoint(x: currentLeft + rCorner, y: topY),
                            radius: rCorner
                        )
                        path.closeSubpath()
                    }
                    .fill(Color.white)
                }

                // 3. Garis Centang & Badan Bawah Terpadu "T -> checkmark" (Fase 3: Tumbuh menyatu dari dasar batang)
                if checkmarkProgress > 0 {
                    Path { path in
                        // Bentuk kanonikal sayap centang yang menyatu mulus dengan dasar batang T
                        path.move(to: CGPoint(x: stemLeft, y: stemBottomY - rStemBottom))
                        path.addQuadCurve(
                            to: CGPoint(x: bottomApexX, y: stemBottomY),
                            control: CGPoint(x: stemLeft, y: stemBottomY)
                        )
                        // Diagonal luar naik ke ujung sayap
                        path.addLine(to: CGPoint(x: cmOuterX, y: cmTopY))
                        // Potongan horizontal atas sayap
                        path.addLine(to: CGPoint(x: cmInnerX, y: cmTopY))
                        // Diagonal dalam turun ke pertemuan batang
                        path.addLine(to: CGPoint(x: stemRight, y: stemJoinY))
                        // Menyatu ke batang tegak
                        path.addLine(to: CGPoint(x: stemRight, y: stemBottomY))
                        path.addLine(to: CGPoint(x: stemLeft, y: stemBottomY))
                        path.closeSubpath()
                    }
                    .fill(Color.white)
                    // Mask menyapu secara diagonal/vertikal dari dasar batang ke ujung sayap
                    .mask(
                        GeometryReader { maskProxy in
                            let mw = maskProxy.size.width
                            let mh = maskProxy.size.height
                            let startY = mh * 0.75
                            let totalSpan = mh * 0.38
                            let currentHeight = totalSpan * checkmarkProgress

                            Rectangle()
                                .frame(width: mw, height: currentHeight + (mh * 0.05))
                                .offset(x: 0, y: startY - currentHeight)
                        }
                    )
                }
            }
        }
    }
}

/// Tampilan logo kanonikal TrackerThings untuk iOS yang konsisten dengan identitas brand.
/// Mendukung rendering vektor presisi tinggi, mode animasi sekuensial (I -> T -> Checkmark),
/// dan penyesuaian otomatis terhadap aksesibilitas `accessibilityReduceMotion`.
public struct BrandLogoView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let size: CGFloat
    private let cornerRadius: CGFloat
    private let showShadow: Bool
    private let isAnimated: Bool

    // Animation progress states (0.0 -> 1.0)
    @State private var stemProgress: CGFloat = 1.0
    @State private var crossbarProgress: CGFloat = 1.0
    @State private var checkmarkProgress: CGFloat = 1.0

    public init(
        size: CGFloat = 64,
        cornerRadius: CGFloat? = nil,
        showShadow: Bool = true,
        isAnimated: Bool = false
    ) {
        self.size = size
        self.cornerRadius = cornerRadius ?? (size * 0.24)
        self.showShadow = showShadow
        self.isAnimated = isAnimated
    }

    public var body: some View {
        ZStack {
            // Background Kontainer Deep Sapphire Navy Kanonikal (Sampling referensi #023075)
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.008, green: 0.188, blue: 0.459), // #023075
                            Color(red: 0.005, green: 0.140, blue: 0.380)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)

            // Monogram Simbol Logo (Solid Putih Murni, Tanpa Gradien / Glossy)
            BrandLogoMarkView(
                stemProgress: isAnimated && !reduceMotion ? stemProgress : 1.0,
                crossbarProgress: isAnimated && !reduceMotion ? crossbarProgress : 1.0,
                checkmarkProgress: isAnimated && !reduceMotion ? checkmarkProgress : 1.0
            )
            .frame(width: size, height: size)
        }
        .shadow(
            color: showShadow ? Color.black.opacity(0.18) : .clear,
            radius: size * 0.10,
            x: 0,
            y: size * 0.05
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Logo TrackerThings")
        .accessibilityAddTraits(.isImage)
        .onAppear {
            if isAnimated && !reduceMotion {
                // Reset ke awal untuk memulai urutan animasi
                stemProgress = 0.0
                crossbarProgress = 0.0
                checkmarkProgress = 0.0

                Task {
                    // 1. Fase I: Garis putih batang stem muncul
                    withAnimation(.easeOut(duration: 0.35)) {
                        stemProgress = 1.0
                    }

                    // 2. Fase I -> T: Palang horizontal berkembang dengan terminal diagonal
                    try? await Task.sleep(nanoseconds: 280_000_000)
                    withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) {
                        crossbarProgress = 1.0
                    }

                    // 3. Fase T -> checkmark: Garis centang tumbuh dari dasar batang ke kanan atas
                    try? await Task.sleep(nanoseconds: 320_000_000)
                    withAnimation(.easeOut(duration: 0.42)) {
                        checkmarkProgress = 1.0
                    }
                }
            }
        }
    }
}

/// Tipografi Wordmark TrackerThings: "Tracker" solid bersih & "Things" dengan gradien glossy reflektif halus.
public struct BrandWordmarkView: View {
    public let size: CGFloat
    public let onDarkBackground: Bool

    public init(size: CGFloat = 32, onDarkBackground: Bool = true) {
        self.size = size
        self.onDarkBackground = onDarkBackground
    }

    public var body: some View {
        HStack(spacing: 0) {
            // Tracker: Tampilan solid dan bersih
            Text("Tracker")
                .font(.system(size: size, weight: .bold, design: .rounded))
                .foregroundStyle(onDarkBackground ? Color.white : AppTheme.Colors.textPrimary)

            // Things: Tampilan gradien glossy / reflektif yang halus dan elegan
            Text("Things")
                .font(.system(size: size, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        stops: [
                            .init(color: onDarkBackground ? Color.white : Color(red: 0.08, green: 0.45, blue: 0.95), location: 0.0),
                            .init(color: Color(red: 0.72, green: 0.89, blue: 1.00), location: 0.35),
                            .init(color: Color.white, location: 0.58),
                            .init(color: Color(red: 0.35, green: 0.76, blue: 0.98), location: 1.0)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("TrackerThings")
    }
}

/// Brand Header yang menyatukan Logo Mark dan Wordmark (untuk Auth / Hero).
public struct BrandHeaderView: View {
    private let subtitle: String?
    private let logoSize: CGFloat

    public init(subtitle: String? = "Portal Manajemen Jadwal & Tugas Akademik", logoSize: CGFloat = 68) {
        self.subtitle = subtitle
        self.logoSize = logoSize
    }

    public var body: some View {
        VStack(spacing: 12) {
            BrandLogoView(size: logoSize)
                .padding(.top, 8)

            BrandWordmarkView(size: 28, onDarkBackground: false)

            if let subtitle = subtitle {
                Text(subtitle)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
    }
}
