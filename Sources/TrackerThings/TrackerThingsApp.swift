import SwiftUI

@main
public struct TrackerThingsApp: App {
    public init() {
        NotificationService.shared.configureForegroundPresentation()
        TrackerThingsShortcuts.updateAppShortcutParameters()
    }

    public var body: some Scene {
        WindowGroup {
            AppRootView()
        }
    }
}

