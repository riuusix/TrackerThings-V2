import SwiftUI

/// Banner status konektivitas offline native yang elegan, responsif, dan tidak mengganggu.
/// Menampilkan indikator saat perangkat offline atau sedang menampilkan snapshot cache lokal.
public struct OfflineBannerView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    public let message: String
    public var lastUpdatedText: String?
    public var onRetry: (() -> Void)?

    public init(
        message: String = "Kamu sedang offline. Menampilkan data terakhir yang tersimpan.",
        lastUpdatedText: String? = nil,
        onRetry: (() -> Void)? = nil
    ) {
        self.message = message
        self.lastUpdatedText = lastUpdatedText
        self.onRetry = onRetry
    }

    public var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "wifi.slash")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.orange)

            VStack(alignment: .leading, spacing: 2) {
                Text(message)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.primary)

                if let updated = lastUpdatedText {
                    Text(updated)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if let onRetry = onRetry {
                Button(action: onRetry) {
                    Label("Coba Lagi", systemImage: "arrow.clockwise")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.18))
                        .foregroundStyle(.orange)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.orange.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color.orange.opacity(0.25), lineWidth: 1)
                )
        }
        .padding(.horizontal)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(message)\(lastUpdatedText != nil ? ". " + lastUpdatedText! : "")")
    }
}

