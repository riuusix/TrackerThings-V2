import SwiftUI

/// Root View yang menangani navigasi kondisional antara status belum terautentikasi (Login/Register) dan antarmuka utama (RootTabView).
public struct AppRootView: View {
    @State private var authViewModel = AuthViewModel()

    public init() {}

    public var body: some View {
        Group {
            if authViewModel.isRestoringSession {
                ZStack {
                    Color(uiColor: .systemGroupedBackground).ignoresSafeArea()
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Memeriksa sesi...")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            } else if authViewModel.isAuthenticated {
                RootTabView()
                    .environment(authViewModel)
            } else {
                NavigationStack {
                    LoginView()
                }
                .environment(authViewModel)
            }
        }
        .task {
            await authViewModel.restoreSession()
            if authViewModel.isAuthenticated {
                _ = await NotificationService.shared.requestAuthorization()
            }
        }
    }
}

