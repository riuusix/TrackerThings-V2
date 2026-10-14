import SwiftUI

/// Reusable pulsating placeholder shimmer for iOS SwiftUI views matching the web Skeleton design
public struct SkeletonCardView: View {
    @State private var isPulsing = false
    public let lines: Int

    public init(lines: Int = 3) {
        self.lines = lines
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
            HStack {
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                    .fill(AppTheme.Colors.neutralBackground)
                    .frame(width: 130, height: 16)

                Spacer()

                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                    .fill(AppTheme.Colors.neutralBackground)
                    .frame(width: 50, height: 18)
            }

            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                ForEach(0..<lines, id: \.self) { index in
                    RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                        .fill(AppTheme.Colors.neutralBackground.opacity(0.7))
                        .frame(maxWidth: index == lines - 1 ? 200 : .infinity, minHeight: 12, maxHeight: 12)
                }
            }
        }
        .cardSurface()
        .opacity(isPulsing ? 0.45 : 0.95)
        .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isPulsing)
        .onAppear {
            isPulsing = true
        }
    }
}

/// Reusable row skeleton for List-based views
public struct SkeletonRowView: View {
    @State private var isPulsing = false

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            HStack {
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                    .fill(AppTheme.Colors.neutralBackground)
                    .frame(width: 60, height: 14)
                Spacer()
                RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                    .fill(AppTheme.Colors.neutralBackground.opacity(0.7))
                    .frame(width: 80, height: 12)
            }

            RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                .fill(AppTheme.Colors.neutralBackground)
                .frame(width: 160, height: 18)

            RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall)
                .fill(AppTheme.Colors.neutralBackground.opacity(0.7))
                .frame(width: 110, height: 12)
        }
        .padding(.vertical, 4)
        .opacity(isPulsing ? 0.45 : 0.95)
        .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isPulsing)
        .onAppear {
            isPulsing = true
        }
    }
}

