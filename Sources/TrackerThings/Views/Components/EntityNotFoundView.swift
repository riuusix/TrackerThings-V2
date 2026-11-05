import SwiftUI

/// Tampilan fallback ketika item akademis dari notifikasi atau tautan deep link tidak ditemukan atau sudah dihapus.
public struct EntityNotFoundView: View {
    public let entityType: String
    public let entityId: Int
    public let message: String?

    @Environment(\.dismiss) private var dismiss

    public init(entityType: String, entityId: Int, message: String? = nil) {
        self.entityType = entityType
        self.entityId = entityId
        self.message = message
    }

    private var localizedTypeName: String {
        switch entityType.lowercased() {
        case "task", "tugas": return "Tugas"
        case "course", "jadwal", "matakuliah": return "Mata Kuliah"
        case "exam", "ujian": return "Jadwal Ujian"
        case "replacementclass", "kelaspengganti": return "Kelas Pengganti"
        default: return "Item Akademik"
        }
    }

    private var iconName: String {
        switch entityType.lowercased() {
        case "task", "tugas": return "checklist.unchecked"
        case "course", "jadwal", "matakuliah": return "book.closed"
        case "exam", "ujian": return "graduationcap"
        case "replacementclass", "kelaspengganti": return "calendar.badge.clock"
        default: return "exclamationmark.triangle"
        }
    }

    public var body: some View {
        VStack(spacing: AppTheme.Metrics.spacingLarge) {
            Spacer()

            Image(systemName: iconName)
                .font(.system(size: 54, weight: .light))
                .foregroundStyle(AppTheme.Colors.warning)
                .padding(.bottom, 8)

            Text("\(localizedTypeName) Tidak Ditemukan")
                .font(AppTheme.Typography.pageTitle)
                .foregroundStyle(AppTheme.Colors.textPrimary)
                .multilineTextAlignment(.center)

            Text(message ?? "Item dengan ID #\(entityId) ini mungkin telah dihapus, sudah kedaluwarsa, atau Anda tidak memiliki akses ke data tersebut.")
                .font(AppTheme.Typography.secondary)
                .foregroundStyle(AppTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .lineSpacing(3)

            Spacer()

            Button {
                dismiss()
            } label: {
                Text("Kembali")
                    .font(AppTheme.Typography.captionBold)
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.Colors.brandPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusMedium, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.Colors.background)
        .navigationTitle(localizedTypeName)
        .navigationBarTitleDisplayMode(.inline)
    }
}
