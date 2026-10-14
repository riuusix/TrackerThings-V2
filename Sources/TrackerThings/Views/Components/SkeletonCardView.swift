import SwiftUI

/// Reusable pulsating placeholder shimmer for iOS SwiftUI views matching the web Skeleton design
public struct SkeletonCardView: View {
    @State private var isPulsing = false
    public let lines: Int

    public init(lines: Int = 3) {
        self.lines = lines
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(uiColor: .tertiarySystemFill))
                    .frame(width: 140, height: 18)

                Spacer()

                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(uiColor: .tertiarySystemFill))
                    .frame(width: 60, height: 20)
            }

            VStack(alignment: .leading, spacing: 8) {
                ForEach(0..<lines, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(uiColor: .quaternarySystemFill))
                        .frame(maxWidth: index == lines - 1 ? 220 : .infinity, minHeight: 14, maxHeight: 14)
                }
            }
        }
        .padding(16)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(uiColor: .tertiarySystemFill))
                    .frame(width: 70, height: 16)
                Spacer()
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(uiColor: .quaternarySystemFill))
                    .frame(width: 90, height: 14)
            }

            RoundedRectangle(cornerRadius: 8)
                .fill(Color(uiColor: .tertiarySystemFill))
                .frame(width: 180, height: 20)

            RoundedRectangle(cornerRadius: 6)
                .fill(Color(uiColor: .quaternarySystemFill))
                .frame(width: 130, height: 14)
        }
        .padding(.vertical, 6)
        .opacity(isPulsing ? 0.45 : 0.95)
        .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isPulsing)
        .onAppear {
            isPulsing = true
        }
    }
}

