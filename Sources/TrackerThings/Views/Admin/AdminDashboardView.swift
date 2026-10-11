import SwiftUI

/// Tampilan antarmuka Admin Panel Dashboard berbasis SwiftUI (RBAC)
public struct AdminDashboardView: View {
    @State private var viewModel = AdminViewModel()

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // MARK: - Banner Status Sistem
                    systemStatusBar

                    // MARK: - Kartu Metrik Grid
                    if let metrics = viewModel.metrics {
                        metricsGrid(metrics: metrics)

                        // MARK: - Daftar Pengguna Terbaru
                        recentUsersSection(users: metrics.recentUsers)
                    } else if viewModel.isLoading {
                        VStack(spacing: 12) {
                            ProgressView()
                                .scaleEffect(1.2)
                            Text("Memuat metrik sistem...")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, minHeight: 250)
                    } else if let error = viewModel.errorMessage {
                        errorStateView(message: error)
                    }
                }
                .padding()
            }
            .navigationTitle("Admin Panel")
            .refreshable {
                await viewModel.loadDashboard()
            }
            .task {
                await viewModel.loadDashboard()
            }
        }
    }

    // MARK: - Komponen UI

    @ViewBuilder
    private var systemStatusBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 10, height: 10)
                    Text(viewModel.metrics?.systemStatus ?? "Online")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                }

                if let serverTime = viewModel.metrics?.serverTime {
                    Text("Sinkronisasi: \(formatServerTime(serverTime))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Label("Role: Administrator", systemImage: "shield.fill")
                .font(.caption.weight(.bold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Color.purple.opacity(0.12))
                .foregroundStyle(.purple)
                .clipShape(Capsule())
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 5, y: 2)
    }

    private func metricsGrid(metrics: AdminDashboardData) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ringkasan Sistem")
                .font(.headline)
                .foregroundStyle(.primary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                metricCard(
                    title: "Total Pengguna",
                    value: "\(metrics.totalUsers)",
                    icon: "person.2.fill",
                    color: .blue
                )

                metricCard(
                    title: "Total Tugas",
                    value: "\(metrics.totalTasks)",
                    icon: "checklist",
                    color: .orange
                )

                metricCard(
                    title: "Mata Kuliah",
                    value: "\(metrics.totalCourses)",
                    icon: "book.fill",
                    color: .green
                )

                metricCard(
                    title: "Jadwal Ujian",
                    value: "\(metrics.totalExams)",
                    icon: "graduationcap.fill",
                    color: .red
                )

                metricCard(
                    title: "Kelas Pengganti",
                    value: "\(metrics.totalReplacements)",
                    icon: "clock.arrow.2.circlepath",
                    color: .purple
                )
            }
        }
    }

    private func metricCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(color.opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: icon)
                        .font(.subheadline)
                        .foregroundStyle(color)
                }
                Spacer()
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.primary)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: .black.opacity(0.03), radius: 4, y: 2)
    }

    private func recentUsersSection(users: [AdminRecentUser]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pengguna Baru Terdaftar")
                .font(.headline)
                .foregroundStyle(.primary)

            if users.isEmpty {
                Text("Belum ada data pengguna.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(users) { user in
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(user.role?.lowercased() == "admin" ? Color.purple.opacity(0.2) : Color.blue.opacity(0.15))
                                    .frame(width: 42, height: 42)
                                Text(user.username.prefix(1).uppercased())
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(user.role?.lowercased() == "admin" ? Color.purple : Color.blue)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(user.fullName ?? user.username)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)

                                    if let role = user.role {
                                        Text(role.uppercased())
                                            .font(.system(size: 9, weight: .bold))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 2)
                                            .background(role.lowercased() == "admin" ? Color.purple.opacity(0.15) : Color.gray.opacity(0.15))
                                            .foregroundStyle(role.lowercased() == "admin" ? Color.purple : Color.secondary)
                                            .clipShape(Capsule())
                                    }
                                }

                                Text("@\(user.username) • \(user.email)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
        }
    }

    private func errorStateView(message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.octagon.fill")
                .font(.system(size: 42))
                .foregroundStyle(.red)

            Text("Gagal Memuat Data Admin")
                .font(.headline)

            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button {
                Task {
                    await viewModel.loadDashboard()
                }
            } label: {
                Label("Coba Lagi", systemImage: "arrow.clockwise")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 40)
        .frame(maxWidth: .infinity)
    }

    private func formatServerTime(_ timeString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: timeString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            displayFormatter.timeStyle = .medium
            return displayFormatter.string(from: date)
        }
        return timeString
    }
}
