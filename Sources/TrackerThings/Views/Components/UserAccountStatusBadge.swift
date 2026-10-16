import SwiftUI

/// Indikator avatar dan status akun untuk toolbar navigasi.
/// Menampilkan avatar (foto profil atau inisial nama), dot status sesi & konektivitas,
/// serta mendukung aksi tap untuk menampilkan ringkasan profil native.
public struct UserAccountStatusBadge: View {
    @Environment(AuthViewModel.self) private var authViewModel
    private let size: CGFloat

    public init(size: CGFloat = 30) {
        self.size = size
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if authViewModel.isAuthenticated {
                UserAvatarView(
                    url: authViewModel.currentUser?.profilePictureUrl,
                    initials: userInitials,
                    size: size,
                    showShadow: false
                )
            } else {
                Circle()
                    .fill(AppTheme.Colors.neutralBackground)
                    .frame(width: size, height: size)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: size * 0.45))
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    )
            }

            // Dot indikator konektivitas & sesi
            Circle()
                .fill(indicatorColor)
                .frame(width: max(8, size * 0.28), height: max(8, size * 0.28))
                .overlay(
                    Circle()
                        .stroke(Color(uiColor: .systemBackground), lineWidth: 1.5)
                )
                .offset(x: 1, y: 1)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
    }

    private var userDisplayName: String {
        if let fullName = authViewModel.currentUser?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !fullName.isEmpty {
            return fullName
        }
        if let username = authViewModel.currentUser?.username.trimmingCharacters(in: .whitespacesAndNewlines), !username.isEmpty {
            return username
        }
        return "Pengguna"
    }

    private var userInitials: String {
        let name = userDisplayName
        if let first = name.first {
            return String(first).uppercased()
        }
        return "P"
    }

    private var indicatorColor: Color {
        if authViewModel.isRestoringSession {
            return AppTheme.Colors.textTertiary
        }
        guard authViewModel.isAuthenticated else {
            return AppTheme.Colors.urgent
        }
        return NetworkMonitor.shared.isConnected ? AppTheme.Colors.success : AppTheme.Colors.warning
    }

    private var accessibilityDescription: String {
        if authViewModel.isRestoringSession {
            return "Status akun: Memulihkan sesi"
        }
        guard authViewModel.isAuthenticated else {
            return "Status akun: Belum masuk atau sesi berakhir"
        }
        let role = authViewModel.currentUser?.role?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "admin" ? ", Admin" : ""
        let connection = NetworkMonitor.shared.isConnected ? "Online" : "Mode Offline"
        return "Akun: \(userDisplayName)\(role), Status: \(connection)"
    }
}

/// Lembar ringkasan akun native yang ditampilkan saat avatar toolbar diketuk.
public struct UserAccountSummarySheet: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: AppTheme.Metrics.spacingLarge) {
                // Header Profil
                VStack(spacing: AppTheme.Metrics.spacingSmall) {
                    if authViewModel.isAuthenticated {
                        UserAvatarView(
                            url: authViewModel.currentUser?.profilePictureUrl,
                            initials: userInitials,
                            size: 68,
                            showShadow: true
                        )
                    } else {
                        Circle()
                            .fill(AppTheme.Colors.neutralBackground)
                            .frame(width: 68, height: 68)
                            .overlay(
                                Image(systemName: "person.crop.circle.badge.exclamationmark")
                                    .font(.system(size: 34))
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                            )
                    }

                    VStack(spacing: 4) {
                        HStack(spacing: 6) {
                            Text(userDisplayName)
                                .font(AppTheme.Typography.sectionHeader)
                                .foregroundStyle(AppTheme.Colors.textPrimary)

                            if isAdmin {
                                Text("ADMIN")
                                    .font(AppTheme.Typography.badge)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(AppTheme.Colors.infoBackground)
                                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                                    .clipShape(Capsule())
                            }
                        }

                        if authViewModel.isAuthenticated, let username = authViewModel.currentUser?.username, !username.isEmpty {
                            Text("@\(username)")
                                .font(AppTheme.Typography.secondary)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                        } else if !authViewModel.isAuthenticated {
                            Text("Sesi Tidak Aktif")
                                .font(AppTheme.Typography.secondary)
                                .foregroundStyle(AppTheme.Colors.urgent)
                        }
                    }
                }
                .padding(.top, AppTheme.Metrics.spacingMedium)

                // Kartu Informasi Akun
                VStack(spacing: 0) {
                    accountInfoRow(
                        icon: "envelope.fill",
                        iconColor: AppTheme.Colors.brandPrimary,
                        title: "Email",
                        value: authViewModel.currentUser?.email ?? "-"
                    )

                    Divider()
                        .padding(.leading, 44)

                    accountInfoRow(
                        icon: "person.badge.shield.checkmark.fill",
                        iconColor: sessionStatusColor,
                        title: "Status Sesi",
                        value: sessionStatusText,
                        badgeColor: sessionStatusColor,
                        badgeBackground: sessionStatusBackgroundColor
                    )

                    Divider()
                        .padding(.leading, 44)

                    accountInfoRow(
                        icon: NetworkMonitor.shared.isConnected ? "wifi" : "wifi.slash",
                        iconColor: networkStatusColor,
                        title: "Status Koneksi",
                        value: networkStatusText,
                        badgeColor: networkStatusColor,
                        badgeBackground: networkStatusBackgroundColor
                    )
                }
                .cardSurface()

                Spacer()
            }
            .padding(.horizontal, AppTheme.Metrics.spacingLarge)
            .background(AppTheme.Colors.background)
            .navigationTitle("Status Akun")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Tutup") {
                        dismiss()
                    }
                    .font(AppTheme.Typography.body.weight(.semibold))
                }
            }
        }
        .presentationDetents([.medium, .fraction(0.48)])
        .presentationDragIndicator(.visible)
    }

    private var userDisplayName: String {
        if let fullName = authViewModel.currentUser?.fullName?.trimmingCharacters(in: .whitespacesAndNewlines), !fullName.isEmpty {
            return fullName
        }
        if let username = authViewModel.currentUser?.username.trimmingCharacters(in: .whitespacesAndNewlines), !username.isEmpty {
            return username
        }
        return "Pengguna"
    }

    private var userInitials: String {
        let name = userDisplayName
        if let first = name.first {
            return String(first).uppercased()
        }
        return "P"
    }

    private var isAdmin: Bool {
        authViewModel.currentUser?.role?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "admin"
    }

    private var sessionStatusText: String {
        if authViewModel.isRestoringSession {
            return "Memeriksa Sesi"
        }
        if authViewModel.isAuthenticated {
            return NetworkMonitor.shared.isConnected ? "Sesi Aktif" : "Sesi Aktif (Cache Lokal)"
        }
        return "Sesi Berakhir"
    }

    private var sessionStatusColor: Color {
        if authViewModel.isRestoringSession {
            return AppTheme.Colors.textSecondary
        }
        return authViewModel.isAuthenticated ? AppTheme.Colors.success : AppTheme.Colors.urgent
    }

    private var sessionStatusBackgroundColor: Color {
        if authViewModel.isRestoringSession {
            return AppTheme.Colors.neutralBackground
        }
        return authViewModel.isAuthenticated ? AppTheme.Colors.successBackground : AppTheme.Colors.urgentBackground
    }

    private var networkStatusText: String {
        NetworkMonitor.shared.isConnected ? "Online" : "Mode Offline"
    }

    private var networkStatusColor: Color {
        NetworkMonitor.shared.isConnected ? AppTheme.Colors.success : AppTheme.Colors.warning
    }

    private var networkStatusBackgroundColor: Color {
        NetworkMonitor.shared.isConnected ? AppTheme.Colors.successBackground : AppTheme.Colors.warningBackground
    }

    @ViewBuilder
    private func accountInfoRow(
        icon: String,
        iconColor: Color,
        title: String,
        value: String,
        badgeColor: Color? = nil,
        badgeBackground: Color? = nil
    ) -> some View {
        HStack(spacing: AppTheme.Metrics.spacingMedium) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 28, height: 28)
                .background(iconColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

            Text(title)
                .font(AppTheme.Typography.body)
                .foregroundStyle(AppTheme.Colors.textPrimary)

            Spacer()

            if let bColor = badgeColor, let bBg = badgeBackground {
                Text(value)
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(bBg)
                    .foregroundStyle(bColor)
                    .clipShape(Capsule())
            } else {
                Text(value)
                    .font(AppTheme.Typography.secondary)
                    .foregroundStyle(AppTheme.Colors.textSecondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 10)
        .frame(minHeight: AppTheme.Metrics.minTouchTarget)
    }
}

