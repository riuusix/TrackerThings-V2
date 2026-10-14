import SwiftUI

public struct ScheduleCardView: View {
    public let item: JadwalGabunganItem
    public var isOffline: Bool = false
    public var onMarkComplete: (() async -> Void)?

    @State private var isProcessing: Bool = false

    public init(
        item: JadwalGabunganItem,
        isOffline: Bool = false,
        onMarkComplete: (() async -> Void)? = nil
    ) {
        self.item = item
        self.isOffline = isOffline
        self.onMarkComplete = onMarkComplete
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            // Header Tags
            HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                if item.tipe == .pengganti {
                    Text("Kelas Pengganti")
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.warningBackground)
                        .foregroundStyle(AppTheme.Colors.warning)
                        .clipShape(Capsule())
                } else {
                    Text("Reguler")
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.infoBackground)
                        .foregroundStyle(AppTheme.Colors.info)
                        .clipShape(Capsule())
                }

                if let kat = item.kategori, !kat.isEmpty {
                    Text(kat)
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.neutralBackground)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .clipShape(Capsule())
                }

                Spacer()

                if item.tipe == .pengganti, let onMarkComplete = onMarkComplete {
                    Button {
                        guard !isProcessing, !isOffline else { return }
                        isProcessing = true
                        Task {
                            defer { isProcessing = false }
                            await onMarkComplete()
                        }
                    } label: {
                        if isProcessing {
                            HStack(spacing: 4) {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(AppTheme.Colors.success)
                                Text("Memproses...")
                            }
                            .font(AppTheme.Typography.badge)
                            .foregroundStyle(AppTheme.Colors.success)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(AppTheme.Colors.successBackground)
                            .clipShape(Capsule())
                        } else {
                            Label("Selesai", systemImage: "checkmark.circle.fill")
                                .font(AppTheme.Typography.badge)
                                .foregroundStyle(isOffline ? AppTheme.Colors.textTertiary : AppTheme.Colors.success)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(isOffline ? AppTheme.Colors.neutralBackground : AppTheme.Colors.successBackground)
                                .clipShape(Capsule())
                        }
                    }
                    .buttonStyle(.plain)
                    .frame(minHeight: AppTheme.Metrics.minTouchTarget)
                    .disabled(isProcessing || isOffline)
                }
            }

            // Course Name
            Text(item.namaMatkul)
                .font(AppTheme.Typography.cardTitle)
                .foregroundStyle(AppTheme.Colors.textPrimary)
                .lineLimit(2)

            // Time & Location Info
            HStack(spacing: AppTheme.Metrics.spacingMedium) {
                Label("\(item.waktuMulai) - \(item.waktuSelesai)", systemImage: "clock")
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(AppTheme.Colors.info)

                if let lokasi = item.lokasi, !lokasi.isEmpty {
                    Label(lokasi, systemImage: "mappin")
                        .font(AppTheme.Typography.caption)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .lineLimit(1)
                }
            }

            if let dosen = item.dosen, !dosen.isEmpty {
                Label(dosen, systemImage: "person")
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textTertiary)
                    .lineLimit(1)
            }

            if let catatan = item.catatan, !catatan.isEmpty {
                Text(catatan)
                    .font(AppTheme.Typography.caption)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.Colors.warningBackground)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
            }
        }
        .cardSurface()
    }
}

