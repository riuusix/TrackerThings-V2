import SwiftUI
import UIKit

/// Semantic feedback severity matching web vocabulary
public enum FeedbackSeverity: Sendable, Equatable {
    case info
    case success
    case warning
    case error

    public var iconName: String {
        switch self {
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        }
    }

    public var tintColor: Color {
        switch self {
        case .info: return .blue
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }

    public var localizedName: String {
        switch self {
        case .info: return "Informasi"
        case .success: return "Berhasil"
        case .warning: return "Peringatan"
        case .error: return "Terjadi Kesalahan"
        }
    }
}

public struct FeedbackToastData: Identifiable, Sendable, Equatable {
    public let id: UUID
    public let message: String
    public let severity: FeedbackSeverity

    public init(id: UUID = UUID(), message: String, severity: FeedbackSeverity = .info) {
        self.id = id
        self.message = message
        self.severity = severity
    }
}

/// Native iOS Toast Banner View with fluid spring animation, Dynamic Island awareness, and VoiceOver support
public struct FeedbackToastBanner: View {
    @Environment(\.colorScheme) private var colorScheme
    let data: FeedbackToastData
    let onDismiss: () -> Void

    public init(data: FeedbackToastData, onDismiss: @escaping () -> Void) {
        self.data = data
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: data.severity.iconName)
                .foregroundStyle(data.severity.tintColor)
                .font(.subheadline.weight(.semibold))

            Text(data.message)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 4)

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(6)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Tutup notifikasi")
            .accessibilityHint("Ketuk dua kali untuk menutup pesan ini")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: 520)
        .background {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.regularMaterial)
                .shadow(
                    color: Color.black.opacity(colorScheme == .dark ? 0.35 : 0.08),
                    radius: 12,
                    x: 0,
                    y: 5
                )
        }
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(data.severity.tintColor.opacity(0.25), lineWidth: 1)
        }
        .padding(.horizontal, 16)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(data.severity.localizedName): \(data.message)")
        .accessibilityAddTraits(.isStaticText)
        .onAppear {
            UIAccessibility.post(
                notification: .announcement,
                argument: "\(data.severity.localizedName): \(data.message)"
            )
        }
    }
}

/// View modifier for presenting toast banners at the top of a screen with safe area awareness
public struct FeedbackToastModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var toast: FeedbackToastData?

    public func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let toastData = toast {
                    let dismissalAnim: Animation = reduceMotion
                        ? .easeInOut(duration: 0.22)
                        : .spring(response: 0.38, dampingFraction: 0.82)

                    FeedbackToastBanner(data: toastData) {
                        withAnimation(dismissalAnim) {
                            toast = nil
                        }
                    }
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .asymmetric(
                                insertion: .move(edge: .top).combined(with: .opacity),
                                removal: .opacity.combined(with: .move(edge: .top))
                            )
                    )
                    .safeAreaPadding(.top)
                    .padding(.top, 8)
                    .onAppear {
                        let duration = toastData.severity == .error ? 5.0 : 3.5
                        Task {
                            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
                            if toast?.id == toastData.id {
                                withAnimation(dismissalAnim) {
                                    toast = nil
                                }
                            }
                        }
                    }
                }
            }
    }
}

public extension View {
    func feedbackToast(toast: Binding<FeedbackToastData?>) -> some View {
        modifier(FeedbackToastModifier(toast: toast))
    }
}
