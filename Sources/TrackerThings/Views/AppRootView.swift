import SwiftUI

/// Root View yang menangani navigasi kondisional antara status belum terautentikasi (Login/Register) dan antarmuka utama (RootTabView).
public struct AppRootView: View {
    @State private var authViewModel = AuthViewModel()

    public init() {}

    public var body: some View {
        Group {
            if authViewModel.isRestoringSession {
                SplashScreenView()
                    .transition(.opacity)
            } else if authViewModel.isAuthenticated {
                RootTabView()
                    .environment(authViewModel)
                    .transition(.opacity)
            } else {
                NavigationStack {
                    LoginView()
                }
                .environment(authViewModel)
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authViewModel.isRestoringSession)
        .animation(.easeInOut(duration: 0.3), value: authViewModel.isAuthenticated)
        .task {
            await authViewModel.restoreSession()
            if authViewModel.isAuthenticated {
                _ = await NotificationService.shared.requestAuthorization()
            }
        }
    }
}

