import SwiftUI

/// Tampilan avatar pengguna yang mendukung foto profil via URL dan fallback inisial nama bergradien.
public struct UserAvatarView: View {
    private let urlString: String?
    private let initials: String
    private let size: CGFloat
    private let showShadow: Bool

    public init(
        url: String?,
        initials: String,
        size: CGFloat = 56,
        showShadow: Bool = true
    ) {
        self.urlString = url
        self.initials = initials.isEmpty ? "U" : initials
        self.size = size
        self.showShadow = showShadow
    }

    private var parsedURL: URL? {
        guard let urlString = urlString?.trimmingCharacters(in: .whitespacesAndNewlines),
              !urlString.isEmpty,
              urlString.lowercased().hasPrefix("http://") || urlString.lowercased().hasPrefix("https://") else {
            return nil
        }
        return URL(string: urlString)
    }

    public var body: some View {
        Group {
            if let validURL = parsedURL {
                AsyncImage(url: validURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                            .frame(width: size, height: size)
                            .clipShape(Circle())
                    case .failure:
                        fallbackInitials
                    case .empty:
                        ZStack {
                            fallbackInitials
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.8)
                        }
                    @unknown default:
                        fallbackInitials
                    }
                }
            } else {
                fallbackInitials
            }
        }
        .frame(width: size, height: size)
        .overlay(
            Circle()
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .shadow(
            color: showShadow ? Color.blue.opacity(0.2) : .clear,
            radius: size * 0.1,
            x: 0,
            y: size * 0.05
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Avatar \(initials)")
    }

    private var fallbackInitials: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color.blue, Color.indigo],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)

            Text(initials)
                .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
        }
    }
}

