import SwiftUI

/// Panel Kotak Aktivitas Akademik (In-App Activity & Notification Inbox).
/// Menyimpan item yang mendarat dari Fly-to-Inbox, mendukung filter status baca/urgensi,
/// dan menghubungkan setiap item langsung ke layar detail entitas melalui `AppNavigationCoordinator`.
public struct ActivityInboxSheet: View {
    @Bindable var store: ActivityInboxStore = .shared
    @Environment(\.dismiss) private var dismiss

    public enum InboxFilter: String, CaseIterable, Identifiable {
        case all = "Semua"
        case unread = "Belum Dibaca"
        case urgent = "Mendesak"

        public var id: String { rawValue }
    }

    @State private var selectedFilter: InboxFilter = .all

    public init(store: ActivityInboxStore = .shared) {
        self.store = store
    }

    private var filteredItems: [NotificationItem] {
        switch selectedFilter {
        case .all:
            return store.items
        case .unread:
            return store.items.filter { !$0.isRead }
        case .urgent:
            return store.items.filter { $0.isUrgent }
        }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                filterHeaderBar

                Divider()
                    .overlay(AppTheme.Colors.divider)

                if filteredItems.isEmpty {
                    emptyInboxState
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(filteredItems) { item in
                                inboxRow(for: item)
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .background(AppTheme.Colors.background.ignoresSafeArea())
            .navigationTitle("Kotak Aktivitas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if store.unreadCount > 0 {
                        Button("Baca Semua") {
                            HapticsHelper.selectionChanged()
                            withAnimation(AppTheme.Motion.inlineExpand) {
                                store.markAllAsRead()
                            }
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.Colors.primary)
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Selesai") {
                        dismiss()
                    }
                    .font(.subheadline.weight(.semibold))
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Filter Header Bar

    private var filterHeaderBar: some View {
        HStack(spacing: 8) {
            ForEach(InboxFilter.allCases) { filter in
                let isSelected = selectedFilter == filter
                Button {
                    HapticsHelper.selectionChanged()
                    withAnimation(AppTheme.Motion.inlineExpand) {
                        selectedFilter = filter
                    }
                } label: {
                    HStack(spacing: 5) {
                        Text(filter.rawValue)
                            .font(.caption.weight(isSelected ? .bold : .medium))
                        if filter == .unread && store.unreadCount > 0 {
                            Text("\(store.unreadCount)")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .monospacedDigit()
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(
                                    Capsule()
                                        .fill(isSelected ? Color.white.opacity(0.24) : AppTheme.Colors.primaryMuted)
                                )
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .foregroundStyle(isSelected ? .white : AppTheme.Colors.textSecondary)
                    .background(
                        Capsule()
                            .fill(isSelected ? AppTheme.Colors.primary : AppTheme.Colors.secondarySurface)
                    )
                }
                .buttonStyle(PressableScaleButtonStyle())
            }

            Spacer()

            if store.items.contains(where: { $0.isRead }) {
                Button {
                    HapticsHelper.impactLight()
                    withAnimation(AppTheme.Motion.inlineExpand) {
                        store.clearReadItems()
                    }
                } label: {
                    Image(systemName: "trash")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .padding(8)
                        .background(AppTheme.Colors.secondarySurface)
                        .clipShape(Circle())
                }
                .buttonStyle(PressableScaleButtonStyle())
                .accessibilityLabel("Bersihkan item yang sudah dibaca")
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Inbox Item Row

    @ViewBuilder
    private func inboxRow(for item: NotificationItem) -> some View {
        let accent = accentColor(for: item)

        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(accent.opacity(item.isRead ? 0.08 : 0.16))
                    .frame(width: 40, height: 40)

                Image(systemName: item.tipe.iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(accent)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if !item.isRead {
                        Circle()
                            .fill(accent)
                            .frame(width: 7, height: 7)
                    }

                    Text(item.namaMatkul)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(accent)
                        .lineLimit(1)

                    Spacer()

                    Text(item.waktu)
                        .font(.caption2)
                        .foregroundStyle(AppTheme.Colors.textTertiary)
                }

                Text(item.judul)
                    .font(.subheadline.weight(item.isRead ? .medium : .bold))
                    .foregroundStyle(item.isRead ? AppTheme.Colors.textSecondary : AppTheme.Colors.textPrimary)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    if item.route != nil {
                        Label("Ketuk untuk buka detail", systemImage: "arrow.turn.down.right")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(AppTheme.Colors.textTertiary)
                    }

                    Spacer()

                    Button {
                        withAnimation(AppTheme.Motion.inlineExpand) {
                            store.dismissItem(id: item.id)
                        }
                    } label: {
                        Text("Hapus")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(AppTheme.Colors.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 2)
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(item.isRead ? AppTheme.Colors.secondarySurface.opacity(0.65) : AppTheme.Colors.secondarySurface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(item.isRead ? AppTheme.Colors.border : accent.opacity(0.28), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            HapticsHelper.impactLight()
            store.openItem(item)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.isRead ? "Sudah dibaca" : "Belum dibaca"): \(item.judul), \(item.namaMatkul), \(item.waktu)")
    }

    // MARK: - Empty State

    private var emptyInboxState: some View {
        VStack(spacing: 12) {
            Spacer()
            ZStack {
                Circle()
                    .fill(AppTheme.Colors.primaryMuted)
                    .frame(width: 64, height: 64)
                Image(systemName: "tray.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(AppTheme.Colors.primary)
            }
            Text(selectedFilter == .all ? "Kotak Aktivitas Bersih" : "Tidak Ada Item pada Filter Ini")
                .font(.headline)
                .foregroundStyle(AppTheme.Colors.textPrimary)

            Text("Pengingat tenggat tugas, jadwal ujian terdekat, dan aktivitas baru yang Anda tambahkan akan tersimpan di sini.")
                .font(.caption)
                .foregroundStyle(AppTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 36)
            Spacer()
        }
    }

    private func accentColor(for item: NotificationItem) -> Color {
        if item.isUrgent {
            return AppTheme.Colors.danger
        }
        switch item.tipe {
        case .tugas:
            return AppTheme.Colors.primary
        case .ujian:
            return AppTheme.Colors.danger
        case .kuliah:
            return AppTheme.Colors.success
        case .pengganti:
            return AppTheme.Colors.warning
        }
    }
}

