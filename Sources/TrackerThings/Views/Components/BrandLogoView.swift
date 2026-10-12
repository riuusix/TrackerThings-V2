import SwiftUI
import UIKit

/// Tampilan logo kanonikal TrackerThings untuk iOS yang konsisten dengan identitas website.
/// Mencoba memuat file artwork dari App Bundle (`AppIcon1024x1024.png` atau `AppIcon.png`),
/// dan menyediakan fallback vektor presisi tinggi jika artwork file tidak tersedia di environment saat ini (mis. Previews).
public struct BrandLogoView: View {
    private let size: CGFloat
    private let cornerRadius: CGFloat
    private let showShadow: Bool

    public init(
        size: CGFloat = 64,
        cornerRadius: CGFloat? = nil,
        showShadow: Bool = true
    ) {
        self.size = size
        self.cornerRadius = cornerRadius ?? (size * 0.28)
        self.showShadow = showShadow
    }

    private var bundledImage: UIImage? {
        let candidates = ["AppIcon1024x1024", "AppIcon", "Icon-App-1024x1024@1x"]
        for name in candidates {
            if let path = Bundle.main.path(forResource: name, ofType: "png"),
               let image = UIImage(contentsOfFile: path) {
                return image
            }
        }
        return UIImage(named: "AppIcon")
    }

    public var body: some View {
        Group {
            if let uiImage = bundledImage {
                Image(uiImage: uiImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else {
                // Fallback rendering vektor presisi: Monogram geometris T di atas background Royal Blue
                ZStack {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 0.0, green: 0.24, blue: 0.65), Color(red: 0.02, green: 0.16, blue: 0.48)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: size, height: size)

                    // Bentuk monogram T geometris presisi dari logo kanonikal
                    GeometryReader { proxy in
                        let w = proxy.size.width
                        let h = proxy.size.height
                        Path { path in
                            // Horizontal bar of T
                            path.move(to: CGPoint(x: w * 0.25, y: h * 0.26))
                            path.addLine(to: CGPoint(x: w * 0.75, y: h * 0.26))
                            path.addLine(to: CGPoint(x: w * 0.68, y: h * 0.35))
                            path.addLine(to: CGPoint(x: w * 0.49, y: h * 0.35))
                            // Vertical stem
                            path.addLine(to: CGPoint(x: w * 0.49, y: h * 0.72))
                            path.addQuadCurve(
                                to: CGPoint(x: w * 0.40, y: h * 0.72),
                                control: CGPoint(x: w * 0.445, y: h * 0.74)
                            )
                            path.addLine(to: CGPoint(x: w * 0.40, y: h * 0.35))
                            path.addLine(to: CGPoint(x: w * 0.25, y: h * 0.35))
                            path.closeSubpath()

                            // Dynamic diagonal wing / tracker chevron
                            path.move(to: CGPoint(x: w * 0.61, y: h * 0.40))
                            path.addLine(to: CGPoint(x: w * 0.73, y: h * 0.40))
                            path.addLine(to: CGPoint(x: w * 0.50, y: h * 0.65))
                            path.addLine(to: CGPoint(x: w * 0.49, y: h * 0.54))
                            path.closeSubpath()
                        }
                        .fill(.white)
                    }
                    .frame(width: size, height: size)
                }
            }
        }
        .shadow(color: showShadow ? Color.blue.opacity(0.3) : .clear, radius: size * 0.12, y: size * 0.06)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Logo TrackerThings")
        .accessibilityAddTraits(.isImage)
    }
}

/// Brand Header yang menyatukan Logo Mark dan Tipografi Wordmark (Tracker + Things dengan gradien cyan-blue).
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

            HStack(spacing: 0) {
                Text("Tracker")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)

                Text("Things")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, Color(red: 0.05, green: 0.72, blue: 0.88)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("TrackerThings")

            if let subtitle = subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }
        }
    }
}

