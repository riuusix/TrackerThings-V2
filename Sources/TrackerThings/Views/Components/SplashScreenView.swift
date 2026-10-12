import SwiftUI

/// Splash screen native TrackerThings yang minimalis, elegan, dan konsisten dengan identitas brand.
/// Menampilkan BrandLogoView dengan animasi scale & fade-in ringan serta status pemulihan sesi.
public struct SplashScreenView: View {
    @State private var isVisible: Bool = false

    public init() {}

    public var body: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                VStack(spacing: 16) {
                    BrandLogoView(size: 88, cornerRadius: 22, showShadow: true)
                        .scaleEffect(isVisible ? 1.0 : 0.88)
                        .opacity(isVisible ? 1.0 : 0.0)

                    HStack(spacing: 0) {
                        Text("Tracker")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)

                        Text("Things")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.blue, Color(red: 0.05, green: 0.72, blue: 0.88)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    }
                    .opacity(isVisible ? 1.0 : 0.0)

                    Text("Portal Manajemen Jadwal & Tugas Akademik")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                        .opacity(isVisible ? 0.9 : 0.0)
                }

                Spacer()

                VStack(spacing: 10) {
                    ProgressView()
                        .controlSize(.regular)
                        .tint(.blue)

                    Text("Memeriksa sesi...")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(.bottom, 48)
                .opacity(isVisible ? 1.0 : 0.0)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                isVisible = true
            }
        }
    }
}

