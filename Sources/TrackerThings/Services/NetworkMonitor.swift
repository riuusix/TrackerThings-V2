import Foundation
import Network

/// Monitor status konektivitas jaringan secara reaktif (NWPathMonitor)
/// Menyediakan publisher dan observable state untuk UI dan service layer.
@Observable
@MainActor
public final class NetworkMonitor {
    public static let shared = NetworkMonitor()

    public private(set) var isConnected: Bool = true
    public private(set) var isConstrained: Bool = false
    public private(set) var connectionType: ConnectionType = .unknown

    public enum ConnectionType: Sendable {
        case wifi
        case cellular
        case wiredEthernet
        case unknown
    }

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "com.trackerthings.networkmonitor", qos: .utility)

    private init() {
        self.monitor = NWPathMonitor()
        self.monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.handlePathUpdate(path)
            }
        }
        self.monitor.start(queue: queue)
    }

    private func handlePathUpdate(_ path: NWPath) {
        let satisfied = (path.status == .satisfied)
        self.isConnected = satisfied
        self.isConstrained = path.isConstrained

        if path.usesInterfaceType(.wifi) {
            self.connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            self.connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            self.connectionType = .wiredEthernet
        } else {
            self.connectionType = .unknown
        }
    }

    /// Helper untuk memeriksa apakah server/jaringan dapat dijangkau
    public func setSimulatedOffline(_ offline: Bool) {
        #if DEBUG
        self.isConnected = !offline
        #endif
    }
}

