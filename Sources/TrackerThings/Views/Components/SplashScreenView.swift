import SwiftUI

/// Splash screen native TrackerThings yang minimalis, elegan, dan fokus pada identitas brand.
/// Menampilkan BrandLogoView dengan animasi sekuensial logo kanonikal (I -> T -> Checkmark),
/// tipografi wordmark glossy, serta status sinkronisasi sesi tanpa delay buatan.
public struct SplashScreenView: View {
    public init() {}

    public var body: some View {
        ZStack {
            // Latar Belakang Deep Sapphire Navy Kanonikal (Sampling referensi #023075)
            Color(red: 0.008, green: 0.188, blue: 0.459)
                .ignoresSafeArea()

            VStack(spacing: AppTheme.Metrics.spacingLarge) {
                Spacer()

                VStack(spacing: AppTheme.Metrics.spacingXLarge) {
                    // Logo Kanonikal dengan Animasi Sekuensial I -> T -> Checkmark
                    BrandLogoView(
                        size: 96,
                        cornerRadius: 24,
                        showShadow: true,
                        isAnimated: true
                    )

                    // Tipografi Wordmark: "Tracker" solid bersih & "Things" glossy reflektif
                    VStack(spacing: 8) {
                        BrandWordmarkView(size: 34, onDarkBackground: true)

                        Text("Portal Manajemen Jadwal & Tugas Akademik")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(Color.white.opacity(0.80))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                }

                Spacer()

                // Indikator Pemeriksaan Sesi Ringkas & Non-Intrusif
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                        .tint(Color.white.opacity(0.75))

                    Text("Memeriksa sesi...")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(Color.white.opacity(0.75))
                }
                .padding(.bottom, 48)
            }
        }
    }
}
