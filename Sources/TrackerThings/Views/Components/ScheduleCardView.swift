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
        VStack(alignment: .leading, spacing: 12) {
            // Header Tags
            HStack {
                if item.tipe == .pengganti {
                    Label("Kelas Pengganti", systemImage: "sparkles")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.15))
                        .foregroundStyle(.orange)
                        .clipShape(Capsule())
                } else {
                    Text("Reguler")
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.12))
                        .foregroundStyle(.blue)
                        .clipShape(Capsule())
                }

                if let kat = item.kategori, !kat.isEmpty {
                    Text(kat)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.secondary.opacity(0.15))
                        .foregroundStyle(.secondary)
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
                                    .tint(.green)
                                Text("Memproses...")
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.green)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.green.opacity(0.12))
                            .clipShape(Capsule())
                        } else {
                            Label("Selesai", systemImage: "checkmark.circle.fill")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(isOffline ? Color.secondary : Color.green)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(isOffline ? Color.secondary.opacity(0.12) : Color.green.opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(isProcessing || isOffline)
                }
            }

            // Course Name
            Text(item.namaMatkul)
                .font(.headline)
                .foregroundStyle(.primary)

            Divider()

            // Details Grid
            VStack(alignment: .leading, spacing: 6) {
                Label("\(item.waktuMulai) - \(item.waktuSelesai)", systemImage: "clock.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.blue)

                if let lokasi = item.lokasi, !lokasi.isEmpty {
                    Label(lokasi, systemImage: "mappin.and.ellipse")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if let dosen = item.dosen, !dosen.isEmpty {
                    Label("Dosen: \(dosen)", systemImage: "person.crop.circle.badge.checkmark")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                if let catatan = item.catatan, !catatan.isEmpty {
                    Text("Catatan: \(catatan)")
                        .font(.caption)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.08))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(16)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
                .shadow(color: .black.opacity(0.04), radius: 6, x: 0, y: 3)
        }
    }
}

