import SwiftUI

/// Signature Interaction 04 — Living Schedule Timeline Card.
/// Menampilkan jadwal kuliah reguler maupun kelas pengganti dengan identitas aksen warna deterministik per mata kuliah,
/// rel waktu tabular, serta laci catatan kontekstual.
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

    private var courseAccent: Color {
        if item.tipe == .pengganti {
            return AppTheme.Colors.warning
        }
        return AppTheme.Colors.courseAccent(for: item.namaMatkul)
    }

    public var body: some View {
        HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
            // Left Time Rail with Course Identity Accent
            VStack(alignment: .center, spacing: 3) {
                Text(item.waktuMulai)
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(courseAccent)
                    .monospacedDigit()

                RoundedRectangle(cornerRadius: 2)
                    .fill(courseAccent.opacity(0.35))
                    .frame(width: 2.5, height: 20)

                Text(item.waktuSelesai)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textTertiary)
                    .monospacedDigit()
            }
            .frame(width: 50)
            .padding(.vertical, 2)

            // Main Content Area
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                // Header Tags & Action
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    if item.tipe == .pengganti {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 9, weight: .bold))
                            Text("Kelas Pengganti")
                                .font(AppTheme.Typography.badge)
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.warningBackground)
                        .foregroundStyle(AppTheme.Colors.warning)
                        .clipShape(Capsule())
                    } else {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(courseAccent)
                                .frame(width: 5, height: 5)
                            Text("Tatap Muka")
                                .font(AppTheme.Typography.badge)
                        }
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(courseAccent.opacity(0.12))
                        .foregroundStyle(courseAccent)
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
                            HapticsHelper.notificationSuccess()
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
                    .multilineTextAlignment(.leading)

                // Location & Lecturer Info
                HStack(spacing: AppTheme.Metrics.spacingMedium) {
                    if let lokasi = item.lokasi, !lokasi.isEmpty {
                        Label(lokasi, systemImage: "mappin.and.ellipse")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }

                    if let dosen = item.dosen, !dosen.isEmpty {
                        Label(dosen, systemImage: "person")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textTertiary)
                            .lineLimit(1)
                    }
                }

                if let catatan = item.catatan, !catatan.isEmpty {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "quote.opening")
                            .font(.caption2)
                            .foregroundStyle(AppTheme.Colors.warning)
                        Text(catatan)
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppTheme.Colors.warningBackground)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                }
            }
        }
        .cardSurface(strokeColor: courseAccent.opacity(0.24), strokeWidth: 1)
    }
}
