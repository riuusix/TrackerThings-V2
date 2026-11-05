import SwiftUI

/// Signature Interaction 04 — Living Course Card Component.
/// Menampilkan kartu mata kuliah dengan aksen identitas warna deterministik (`AppTheme.Colors.courseAccent`),
/// rel waktu tabular, serta menu pengelolaan kontekstual.
public struct CourseCardView: View {
    public let course: JadwalItem
    public var onEdit: (() -> Void)? = nil
    public var onDelete: (() -> Void)? = nil

    public init(
        course: JadwalItem,
        onEdit: (() -> Void)? = nil,
        onDelete: (() -> Void)? = nil
    ) {
        self.course = course
        self.onEdit = onEdit
        self.onDelete = onDelete
    }

    private var courseAccent: Color {
        AppTheme.Colors.courseAccent(for: course.namaMatkul)
    }

    public var body: some View {
        HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
            // Left Time Rail with Deterministic Course Accent
            VStack(alignment: .center, spacing: 3) {
                Text(course.waktuMulai)
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(courseAccent)
                    .monospacedDigit()

                RoundedRectangle(cornerRadius: 2)
                    .fill(courseAccent.opacity(0.35))
                    .frame(width: 2.5, height: 18)

                Text(course.waktuSelesai)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textTertiary)
                    .monospacedDigit()
            }
            .frame(width: 50)
            .padding(.vertical, 2)

            // Main Info Content
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                // Header Baris 1: Hari, Kategori & Menu Aksi
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    // Hari Badge
                    HStack(spacing: 4) {
                        Circle()
                            .fill(courseAccent)
                            .frame(width: 5, height: 5)
                        Text(course.hari)
                            .font(AppTheme.Typography.badge)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(courseAccent.opacity(0.14))
                    .foregroundStyle(courseAccent)
                    .clipShape(Capsule())

                    // Kategori Badge
                    if let kategori = course.kategori, !kategori.isEmpty {
                        Text(kategori)
                            .font(AppTheme.Typography.badge)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(AppTheme.Colors.neutralBackground)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                            .clipShape(Capsule())
                    }

                    Spacer()

                    // Menu Opsi Cepat (Edit & Hapus)
                    if onEdit != nil || onDelete != nil {
                        Menu {
                            if let onEdit = onEdit {
                                Button {
                                    onEdit()
                                } label: {
                                    Label("Edit Kuliah", systemImage: "pencil")
                                }
                            }

                            if let onDelete = onDelete {
                                Button(role: .destructive) {
                                    onDelete()
                                } label: {
                                    Label("Hapus Kuliah", systemImage: "trash")
                                }
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .frame(
                                    width: AppTheme.Metrics.minTouchTarget,
                                    height: AppTheme.Metrics.minTouchTarget,
                                    alignment: .trailing
                                )
                                .contentShape(Rectangle())
                        }
                    }
                }

                // Nama Mata Kuliah
                Text(course.namaMatkul)
                    .font(AppTheme.Typography.cardTitle)
                    .foregroundStyle(AppTheme.Colors.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .multilineTextAlignment(.leading)

                // Grid Informasi: Ruang & Dosen
                HStack(spacing: AppTheme.Metrics.spacingMedium) {
                    if let lokasi = course.lokasi, !lokasi.isEmpty {
                        HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.caption)
                                .foregroundStyle(courseAccent)
                            Text(lokasi)
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .lineLimit(1)
                        }
                    }

                    if let dosen = course.dosen, !dosen.isEmpty {
                        HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                            Image(systemName: "person.circle")
                                .font(.caption)
                                .foregroundStyle(AppTheme.Colors.textTertiary)
                            Text(dosen)
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
        .cardSurface(strokeColor: courseAccent.opacity(0.24), strokeWidth: 1)
    }
}
