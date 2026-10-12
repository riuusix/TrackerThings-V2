import SwiftUI

public enum SubmitButtonState: Equatable, Sendable {
    case idle
    case loading(String)
    case success(String)

    public var isProcessing: Bool {
        switch self {
        case .idle: return false
        case .loading, .success: return true
        }
    }
}

/// Label tombol reusable dengan transisi animasi native dari state idle -> loading -> checkmark feedback.
public struct SubmitButtonLabel: View {
    public let state: SubmitButtonState
    public let idleTitle: String
    public let idleIcon: String?

    public init(
        state: SubmitButtonState,
        idleTitle: String = "Simpan",
        idleIcon: String? = nil
    ) {
        self.state = state
        self.idleTitle = idleTitle
        self.idleIcon = idleIcon
    }

    public var body: some View {
        HStack(spacing: 6) {
            switch state {
            case .idle:
                if let idleIcon = idleIcon {
                    Image(systemName: idleIcon)
                }
                Text(idleTitle)
            case .loading(let text):
                ProgressView()
                    .controlSize(.small)
                Text(text)
            case .success(let text):
                Image(systemName: "checkmark")
                    .fontWeight(.bold)
                    .foregroundStyle(.green)
                Text(text)
                    .foregroundStyle(.green)
            }
        }
        .animation(.snappy(duration: 0.25), value: state)
    }
}

