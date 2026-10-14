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
        VStack(alignment: .leading, spacing: AppTheme.Metrics.spacingSmall) {
            // Header Baris 1: Hari, Kategori & Menu Aksi
            HStack(spacing: AppTheme.Metrics.spacingXSmall) {
                // Hari Badge
                Text(course.hari)
                    .font(AppTheme.Typography.badge)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(AppTheme.Colors.infoBackground)
                    .foregroundStyle(AppTheme.Colors.brandPrimary)
                    .clipShape(Capsule())

                // Kategori Badge
                if let kategori = course.kategori, !kategori.isEmpty {
                    Text(kategori)
                        .font(AppTheme.Typography.badge)
                        .padding(.horizontal, 8)
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
                .font(AppTheme.Typography.sectionHeader)
                .foregroundStyle(AppTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            // Grid Informasi: Jam & Ruang
            HStack(spacing: AppTheme.Metrics.spacingMedium) {
                HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                    Image(systemName: "clock")
                        .font(.caption)
                        .foregroundStyle(AppTheme.Colors.brandPrimary)
                    Text("\(course.waktuMulai) - \(course.waktuSelesai)")
                        .font(AppTheme.Typography.captionBold)
                        .foregroundStyle(AppTheme.Colors.textSecondary)
                }

                if let lokasi = course.lokasi, !lokasi.isEmpty {
                    HStack(spacing: AppTheme.Metrics.spacingXXSmall) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption)
                            .foregroundStyle(AppTheme.Colors.brandAccent)
                        Text(lokasi)
                            .font(AppTheme.Typography.captionBold)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                            .lineLimit(1)
                    }
                }
            }

            // Dosen Pengampu
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
        .cardSurface()
    }
}

