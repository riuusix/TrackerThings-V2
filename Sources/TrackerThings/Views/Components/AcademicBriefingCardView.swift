import SwiftUI

public struct AcademicBriefingCardView: View {
    public let summary: AcademicIntelligenceSummary

    public init(summary: AcademicIntelligenceSummary) {
        self.summary = summary
    }

    private var statusTitle: String {
        guard let briefing = summary.briefing else { return "INFO AKADEMIK" }
        switch briefing.status {
        case "urgent": return "PERHATIAN DIPERLUKAN"
        case "heavy": return "HARI PADAT"
        case "moderate": return "BEBAN MODERAT"
        default: return "JADWAL TENANG"
        }
    }

    private var statusColor: Color {
        guard let briefing = summary.briefing else { return AppTheme.Colors.info }
        switch briefing.status {
        case "urgent": return AppTheme.Colors.urgent
        case "heavy": return AppTheme.Colors.warning
        case "moderate": return AppTheme.Colors.info
        default: return AppTheme.Colors.success
        }
    }

    private var statusBackgroundColor: Color {
        guard let briefing = summary.briefing else { return AppTheme.Colors.infoBackground }
        switch briefing.status {
        case "urgent": return AppTheme.Colors.urgentBackground
        case "heavy": return AppTheme.Colors.warningBackground
        case "moderate": return AppTheme.Colors.infoBackground
        default: return AppTheme.Colors.successBackground
        }
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingMedium) {
            // Header: Title and Status Badge
            HStack(alignment: .center) {
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    Image(systemName: "sparkles")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.brandPrimary)

                    Text("RINGKASAN AKADEMIK")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }

                Spacer()

                Text(statusTitle)
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusBackgroundColor)
                    .foregroundStyle(statusColor)
                    .clipShape(Capsule())
            }

            // Headline
            if let briefing = summary.briefing {
                Text(briefing.headline)
                    .font(AppTheme.Typography.cardTitle)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                    .lineSpacing(2)

                // Metric Pills
                HStack(spacing: AppTheme.Metrics.spacingSmall) {
                    MetricChip(
                        icon: "book.fill",
                        title: "\(briefing.todayClassesCount) Kuliah",
                        subtitle: "\(briefing.todayTotalSks) SKS",
                        color: AppTheme.Colors.info
                    )

                    if briefing.overdueTasksCount > 0 {
                        MetricChip(
                            icon: "exclamationmark.triangle.fill",
                            title: "\(briefing.overdueTasksCount) Terlewat",
                            subtitle: "Tugas",
                            color: AppTheme.Colors.urgent
                        )
                    }

                    MetricChip(
                        icon: "clock.fill",
                        title: "\(briefing.dueTodayTasksCount) Hari Ini",
                        subtitle: "Tugas",
                        color: briefing.dueTodayTasksCount > 0 ? AppTheme.Colors.warning : AppTheme.Colors.textSecondary
                    )

                    if briefing.upcomingExamsCount > 0 {
                        MetricChip(
                            icon: "graduationcap.fill",
                            title: "\(briefing.upcomingExamsCount) Ujian",
                            subtitle: "7 Hari",
                            color: AppTheme.Colors.warning
                        )
                    }
                }
            }

            // Schedule Conflicts Alert (if any)
            if let conflicts = summary.conflicts, !conflicts.isEmpty {
                VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingXSmall) {
                    HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                        Image(systemName: "exclamationmark.octagon.fill")
                            .foregroundStyle(AppTheme.Colors.urgent)
                            .font(AppTheme.Typography.captionBold)

                        Text("Bentrok Jadwal Terdeteksi (\(conflicts.count))")
                            .font(AppTheme.Typography.captionBold)
                            .foregroundStyle(AppTheme.Colors.urgent)
                    }

                    ForEach(conflicts) { conflict in
                        Text("• \(conflict.day): \(conflict.item1.title) (\(conflict.item1.time)) bertabrakan dengan \(conflict.item2.title) (\(conflict.item2.time))")
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                    }
                }
                .padding(AppTheme.Metrics.spacingSmall)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AppTheme.Colors.urgentBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
            }
        }
        .cardSurface(strokeColor: statusColor.opacity(0.25), strokeWidth: 1)
    }
}

private struct MetricChip: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(AppTheme.Typography.badge)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                Text(subtitle)
                    .font(.system(size: 9))
                    .foregroundStyle(AppTheme.Colors.textTertiary)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(AppTheme.Colors.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
    }
}
