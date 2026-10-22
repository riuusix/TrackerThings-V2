import SwiftUI
import ImageIO
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Animated Image Decoder (APNG / GIF via ImageIO)

#if canImport(UIKit)
@MainActor
public enum AnimatedImageDecoder {
    private static let cache = NSCache<NSString, UIImage>()

    public static func decode(data: Data, key: String? = nil) -> (image: UIImage, duration: TimeInterval)? {
        let cacheKey = key as NSString?
        if let cacheKey = cacheKey, let cached = cache.object(forKey: cacheKey) {
            return (cached, cached.duration)
        }

        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        guard count > 0 else { return nil }

        if count == 1 {
            if let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) {
                let single = UIImage(cgImage: cgImage)
                if let cacheKey = cacheKey {
                    cache.setObject(single, forKey: cacheKey)
                }
                return (single, 0)
            }
            return nil
        }

        var images: [UIImage] = []
        images.reserveCapacity(count)
        var totalDuration: TimeInterval = 0

        for i in 0..<count {
            guard let cgImage = CGImageSourceCreateImageAtIndex(source, i, nil) else { continue }
            let frameDuration = getFrameDuration(source: source, index: i)
            totalDuration += frameDuration
            images.append(UIImage(cgImage: cgImage))
        }

        guard !images.isEmpty else { return nil }
        let duration = totalDuration > 0 ? totalDuration : Double(count) * 0.04
        guard let animated = UIImage.animatedImage(with: images, duration: duration) else { return nil }
        if let cacheKey = cacheKey {
            cache.setObject(animated, forKey: cacheKey)
        }
        return (animated, duration)
    }

    private static func getFrameDuration(source: CGImageSource, index: Int) -> TimeInterval {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any] else {
            return 0.04
        }
        // Check PNG dictionary (for APNG transparency, keys are "UnclampedDelayTime" and "DelayTime")
        if let pngDict = properties[kCGImagePropertyPNGDictionary] as? [CFString: Any] {
            let unclampedKey = "UnclampedDelayTime" as CFString
            let delayKey = "DelayTime" as CFString
            if let unclamped = pngDict[unclampedKey] as? TimeInterval, unclamped > 0 {
                return unclamped
            }
            if let delay = pngDict[delayKey] as? TimeInterval, delay > 0 {
                return delay
            }
        }
        // Check GIF dictionary
        if let gifDict = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any] {
            if let unclamped = gifDict[kCGImagePropertyGIFUnclampedDelayTime] as? TimeInterval, unclamped > 0 {
                return unclamped
            }
            if let delay = gifDict[kCGImagePropertyGIFDelayTime] as? TimeInterval, delay > 0 {
                return delay
            }
        }
        return 0.04
    }
}

public struct NativeAnimatedImageView: UIViewRepresentable {
    public let animatedImage: UIImage
    public var contentMode: UIView.ContentMode = .scaleAspectFit

    public init(animatedImage: UIImage, contentMode: UIView.ContentMode = .scaleAspectFit) {
        self.animatedImage = animatedImage
        self.contentMode = contentMode
    }

    public func makeUIView(context: Context) -> UIImageView {
        let imageView = UIImageView()
        imageView.contentMode = contentMode
        imageView.image = animatedImage
        imageView.clipsToBounds = true
        imageView.backgroundColor = .clear
        imageView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        imageView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        imageView.startAnimating()
        return imageView
    }

    public func updateUIView(_ uiView: UIImageView, context: Context) {
        if uiView.image !== animatedImage {
            uiView.image = animatedImage
            uiView.startAnimating()
        }
        uiView.contentMode = contentMode
    }

    public static func dismantleUIView(_ uiView: UIImageView, coordinator: ()) {
        uiView.stopAnimating()
        uiView.image = nil
    }
}
#endif

// MARK: - Engine Loader View (SwiftUI Component)

public struct EngineLoaderView: View {
    public let engine: ScheduleImportEngine
    public var customMessage: String? = nil
    public var onCancel: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    public init(
        engine: ScheduleImportEngine,
        customMessage: String? = nil,
        onCancel: (() -> Void)? = nil
    ) {
        self.engine = engine
        self.customMessage = customMessage
        self.onCancel = onCancel
    }

    private var resourceName: String {
        "\(engine.assetBaseName)_transparent"
    }

    private func loadAssetData() -> Data? {
        let base = engine.assetBaseName
        // 1. Try transparent APNG from bundle
        if let url = findResourceURL(name: "\(base)_transparent", ext: "png") {
            if let data = try? Data(contentsOf: url) {
                return data
            }
        }
        // 2. Try GIF from bundle
        if let url = findResourceURL(name: base, ext: "gif") {
            if let data = try? Data(contentsOf: url) {
                return data
            }
        }
        return nil
    }

    private func findResourceURL(name: String, ext: String) -> URL? {
        #if SWIFT_PACKAGE
        if let url = Bundle.module.url(forResource: name, withExtension: ext) {
            return url
        }
        if let subUrl = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: "Loaders") {
            return subUrl
        }
        #endif
        if let url = Bundle.main.url(forResource: name, withExtension: ext) {
            return url
        }
        if let subUrl = Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "Loaders") {
            return subUrl
        }
        return nil
    }

    public var body: some View {
        VStack(spacing: AppTheme.Metrics.spacingMedium) {
            // Engine animation container
            ZStack {
                #if canImport(UIKit)
                if !reduceMotion, let data = loadAssetData(), let decoded = AnimatedImageDecoder.decode(data: data, key: engine.assetBaseName) {
                    NativeAnimatedImageView(animatedImage: decoded.image)
                        .frame(width: 108, height: 108)
                } else {
                    staticFallbackView
                }
                #else
                staticFallbackView
                #endif
            }
            .frame(width: 116, height: 116)

            // Engine & Stage Metadata
            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(AppTheme.Colors.brandPrimary)
                        .frame(width: 6, height: 6)
                    Text(engineBadgeText)
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.brandPrimary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(AppTheme.Colors.brandPrimary.opacity(0.12))
                .clipShape(Capsule())

                Text(customMessage ?? engine.statusMessage)
                    .font(AppTheme.Typography.cardTitle)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Text(engine.subMessage)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            if let onCancel = onCancel {
                Button(role: .cancel, action: onCancel) {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .bold))
                        Text("Batalkan Proses")
                            .font(AppTheme.Typography.captionBold)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(AppTheme.Colors.borderSubtle.opacity(0.4))
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(customMessage ?? engine.statusMessage)
    }

    private var staticFallbackView: some View {
        ZStack {
            Circle()
                .fill(AppTheme.Colors.brandPrimary.opacity(0.1))
                .frame(width: 96, height: 96)
            ProgressView()
                .controlSize(.large)
                .tint(AppTheme.Colors.brandPrimary)
        }
    }

    private var engineBadgeText: String {
        switch engine {
        case .localAppleVision:
            return "APPLE VISION OCR"
        case .typescript:
            return "TYPESCRIPT ENGINE"
        case .python:
            return "PYTHON REFINEMENT"
        case .serverInternet:
            return "SERVER INTELLIGENCE"
        case .react:
            return "REACT CLIENT"
        }
    }
}

