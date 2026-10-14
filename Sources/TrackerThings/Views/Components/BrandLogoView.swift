import SwiftUI
import UIKit

/// Landmark geometri kanonikal TrackerThings dari gambar referensi resmi (media_1792004406941_078456aa.webp).
private enum BrandLogoGeometry {
    static let topY: CGFloat = 0.2646
    static let cbBotY: CGFloat = 0.3535
    static let cbLeft: CGFloat = 0.2520
    static let cbRightTop: CGFloat = 0.7441
    static let cbRightBot: CGFloat = 0.6689

    static let stemLeft: CGFloat = 0.3984
    static let stemRight: CGFloat = 0.4912
    static let stemJoinY: CGFloat = 0.5518
    static let stemBottomY: CGFloat = 0.7334
    static let bottomApexX: CGFloat = 0.4500

    static let cmTopY: CGFloat = 0.4033
    static let cmInnerX: CGFloat = 0.6113
    static let cmOuterX: CGFloat = 0.7227

    static let rCorner: CGFloat = 0.010
    static let rStemBottom: CGFloat = 0.024
}

/// Shape monolitik animatable untuk monogram TrackerThings yang menggabungkan seluruh geometri kanonikal
/// ke dalam satu progress tunggal [0.0...1.0]:
/// - Fase 1 (0.00...0.33): Batang vertikal "I" digambar dari atas ke bawah.
/// - Fase 2 (0.33...0.66): Palang horizontal "T" digambar dari kiri ke kanan dengan terminal diagonal 45°.
/// - Fase 3 (0.66...1.00): Sayap centang digambar dari dasar batang ke kanan atas hingga siluet kanonikal sempurna.
public struct BrandLogoMonogramShape: Shape {
    public var progress: CGFloat

    public var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    public init(progress: CGFloat = 1.0) {
        self.progress = progress
    }

    public func path(in rect: CGRect) -> Path {
        var path = Path()
        let p = min(max(progress, 0.0), 1.0)
        guard p > 0 else { return path }

        let w = rect.width
        let h = rect.height

        let topY = h * BrandLogoGeometry.topY
        let cbBotY = h * BrandLogoGeometry.cbBotY
        let cbLeft = w * BrandLogoGeometry.cbLeft
        let cbRightTop = w * BrandLogoGeometry.cbRightTop
        let cbRightBot = w * BrandLogoGeometry.cbRightBot

        let stemLeft = w * BrandLogoGeometry.stemLeft
        let stemRight = w * BrandLogoGeometry.stemRight
        let stemJoinY = h * BrandLogoGeometry.stemJoinY
        let stemBottomY = h * BrandLogoGeometry.stemBottomY
        let bottomApexX = w * BrandLogoGeometry.bottomApexX

        let cmTopY = h * BrandLogoGeometry.cmTopY
        let cmInnerX = w * BrandLogoGeometry.cmInnerX
        let cmOuterX = w * BrandLogoGeometry.cmOuterX

        let rCorner = w * BrandLogoGeometry.rCorner
        let rStemBottom = w * BrandLogoGeometry.rStemBottom

        // Pemetaan eksplisit & kontinu per fase dengan clamping 0...1
        let pStem = min(max(p / 0.33, 0.0), 1.0)
        let pCb = min(max((p - 0.33) / 0.33, 0.0), 1.0)
        let pCm = min(max((p - 0.66) / 0.34, 0.0), 1.0)

        // 1. Subpath Batang Vertikal "I" (Fase 1)
        if pStem > 0 {
            let currBottomY = topY + (stemBottomY - topY) * pStem
            path.move(to: CGPoint(x: stemLeft, y: topY))
            path.addLine(to: CGPoint(x: stemRight, y: topY))

            if pStem < 1.0 {
                path.addLine(to: CGPoint(x: stemRight, y: currBottomY))
                path.addLine(to: CGPoint(x: stemLeft, y: currBottomY))
            } else {
                path.addLine(to: CGPoint(x: stemRight, y: stemBottomY - rStemBottom))
                path.addQuadCurve(
                    to: CGPoint(x: bottomApexX, y: stemBottomY),
                    control: CGPoint(x: stemRight, y: stemBottomY)
                )
                path.addQuadCurve(
                    to: CGPoint(x: stemLeft, y: stemBottomY - rStemBottom),
                    control: CGPoint(x: stemLeft, y: stemBottomY)
                )
            }
            path.closeSubpath()
        }

        // 2. Subpath Palang Horizontal "T" (Fase 2)
        if pCb > 0 {
            let totalSpan = cbRightTop - cbLeft
            let currX = cbLeft + totalSpan * pCb

            path.move(to: CGPoint(x: cbLeft + rCorner, y: topY))

            if currX <= cbRightBot {
                path.addLine(to: CGPoint(x: currX, y: topY))
                path.addLine(to: CGPoint(x: currX, y: cbBotY))
                path.addLine(to: CGPoint(x: cbLeft + rCorner, y: cbBotY))
            } else {
                let alpha = (currX - cbRightBot) / (cbRightTop - cbRightBot)
                let currYSlant = cbBotY + (topY - cbBotY) * alpha

                path.addLine(to: CGPoint(x: currX, y: topY))
                path.addLine(to: CGPoint(x: currX, y: currYSlant))
                path.addLine(to: CGPoint(x: cbRightBot, y: cbBotY))
                path.addLine(to: CGPoint(x: cbLeft + rCorner, y: cbBotY))
            }

            path.addArc(
                tangent1End: CGPoint(x: cbLeft, y: cbBotY),
                tangent2End: CGPoint(x: cbLeft, y: topY),
                radius: rCorner
            )
            path.addLine(to: CGPoint(x: cbLeft, y: topY + rCorner))
            path.addArc(
                tangent1End: CGPoint(x: cbLeft, y: topY),
                tangent2End: CGPoint(x: cbLeft + rCorner, y: topY),
                radius: rCorner
            )
            path.closeSubpath()
        }

        // 3. Subpath Sayap Centang (Fase 3)
        if pCm > 0 {
            let currY = stemBottomY + (cmTopY - stemBottomY) * pCm
            let alphaOut = (currY - stemBottomY) / (cmTopY - stemBottomY)
            let currXOut = bottomApexX + (cmOuterX - bottomApexX) * alphaOut

            path.move(to: CGPoint(x: stemLeft, y: stemBottomY - rStemBottom))
            path.addQuadCurve(
                to: CGPoint(x: bottomApexX, y: stemBottomY),
                control: CGPoint(x: stemLeft, y: stemBottomY)
            )
            path.addLine(to: CGPoint(x: currXOut, y: currY))

            if currY >= stemJoinY {
                path.addLine(to: CGPoint(x: stemRight, y: currY))
            } else {
                let alphaIn = (currY - stemJoinY) / (cmTopY - stemJoinY)
                let currXIn = stemRight + (cmInnerX - stemRight) * alphaIn

                path.addLine(to: CGPoint(x: currXIn, y: currY))
                path.addLine(to: CGPoint(x: stemRight, y: stemJoinY))
            }

            path.addLine(to: CGPoint(x: stemRight, y: stemBottomY))
            path.addLine(to: CGPoint(x: stemLeft, y: stemBottomY))
            path.closeSubpath()
        }

        return path
    }
}

/// Komponen visual Monogram Logo Geometris Kanonikal TrackerThings.
/// Mempertahankan kompatibilitas API publik dengan initializer yang ada.
public struct BrandLogoMarkView: View {
    public let progress: CGFloat

    public init(progress: CGFloat = 1.0) {
        self.progress = progress
    }

    public init(
        stemProgress: CGFloat = 1.0,
        crossbarProgress: CGFloat = 1.0,
        checkmarkProgress: CGFloat = 1.0
    ) {
        // Pemetaan kompatibilitas mundur
        if stemProgress < 1.0 {
            self.progress = stemProgress * 0.33
        } else if crossbarProgress < 1.0 {
            self.progress = 0.33 + crossbarProgress * 0.33
        } else {
            self.progress = 0.66 + checkmarkProgress * 0.34
        }
    }

    public var body: some View {
        BrandLogoMonogramShape(progress: progress)
            .fill(Color.white)
    }
}

/// Tampilan logo kanonikal TrackerThings untuk iOS yang konsisten dengan identitas brand.
/// Mendukung rendering vektor presisi tinggi, animasi sekuensial (I -> T -> Checkmark)
/// dengan kontrol progress tunggal native, serta penyesuaian dinamis aksesibilitas Reduce Motion.
public struct BrandLogoView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let size: CGFloat
    private let cornerRadius: CGFloat
    private let showShadow: Bool
    private let isAnimated: Bool

    // Progress tunggal dinamis: diinisialisasi 0.0 jika animasi aktif agar tidak ada flash logo final
    @State private var animationProgress: CGFloat
    @State private var hasCompletedAnimation: Bool = false

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
        self._animationProgress = State(initialValue: isAnimated ? 0.0 : 1.0)
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
            BrandLogoMonogramShape(progress: effectiveProgress)
                .fill(Color.white)
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
        .task {
            guard isAnimated, !reduceMotion, !hasCompletedAnimation else { return }

            withAnimation(.easeInOut(duration: 1.15)) {
                animationProgress = 1.0
            }

            do {
                try await Task.sleep(nanoseconds: 1_200_000_000)
                guard !Task.isCancelled else { return }
                hasCompletedAnimation = true
            } catch {
                // Task dibatalkan ketika view di-dismiss (misal: navigasi selesai)
            }
        }
    }

    private var effectiveProgress: CGFloat {
        if reduceMotion || !isAnimated || hasCompletedAnimation {
            return 1.0
        }
        return animationProgress
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
