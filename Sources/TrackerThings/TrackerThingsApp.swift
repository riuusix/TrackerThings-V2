import SwiftUI

@main
public struct TrackerThingsApp: App {
    public init() {
        NotificationService.shared.configureForegroundPresentation()
    }

    public var body: some Scene {
        WindowGroup {
            AppRootView()
        }
    }
}

