import SwiftUI

/// Tampilan kartu representasi mata kuliah sesuai sistem desain AppTheme TrackerThings V2.
/// Menampilkan hierarki visual terstruktur: hari, kategori, nama kuliah, jam, ruang, dosen, serta aksi edit & hapus.
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

    public var body: some View {
        HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
            // Left Time & SKS Rail
            VStack(alignment: .center, spacing: 3) {
                Text(course.waktuMulai)
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                    .monospacedDigit()

                Rectangle()
                    .fill(AppTheme.Colors.borderSubtle)
                    .frame(width: 1.5, height: 16)

                Text(course.waktuSelesai)
                    .font(AppTheme.Typography.caption)
                    .foregroundStyle(AppTheme.Colors.textTertiary)
                    .monospacedDigit()

                if let sks = course.sks, sks > 0 {
                    Text("\(sks) SKS")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(AppTheme.Colors.neutralBackground)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                        .clipShape(Capsule())
                        .padding(.top, 2)
                }
            }
            .frame(width: 48)
            .padding(.vertical, 2)

            // Main Info Content
            VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
                // Header Baris 1: Hari, Kategori & Menu Aksi
                HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                    // Hari Badge
                    Text(course.hari)
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(AppTheme.Colors.infoBackground)
                        .foregroundStyle(AppTheme.Colors.brandPrimary)
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

                // Grid Informasi: Ruang & Dosen
                HStack(spacing: AppTheme.Metrics.spacingMedium) {
                    if let lokasi = course.lokasi, !lokasi.isEmpty {
                        HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.caption)
                                .foregroundStyle(AppTheme.Colors.brandAccent)
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
        .cardSurface(strokeColor: AppTheme.Colors.borderSubtle, strokeWidth: 1)
    }
}

