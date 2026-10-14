import SwiftUI

/// Reusable error state view with explicit retry button to distinguish error from empty state
public struct ErrorRetryView: View {
    public let title: String
    public let message: String
    public let iconName: String
    public let onRetry: () async -> Void

    @State private var isRetrying: Bool = false

    public init(
        title: String = "Gagal Memuat Data",
        message: String,
        iconName: String = "exclamationmark.triangle.fill",
        onRetry: @escaping () async -> Void
    ) {
        self.title = title
        self.message = message
        self.iconName = iconName
        self.onRetry = onRetry
    }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: iconName)
                .font(.system(size: 44))
                .foregroundStyle(.orange)

            VStack(spacing: 6) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)

                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Button {
                guard !isRetrying else { return }
                isRetrying = true
                Task {
                    await onRetry()
                    isRetrying = false
                }
            } label: {
                HStack(spacing: 8) {
                    if isRetrying {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                    Text(isRetrying ? "Mencoba Lagi..." : "Coba Lagi")
                        .fontWeight(.semibold)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)
            .disabled(isRetrying)
        }
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity)
    }
}

