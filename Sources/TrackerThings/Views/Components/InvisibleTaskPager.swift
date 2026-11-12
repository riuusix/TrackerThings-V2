import SwiftUI

/// Matematika deterministik untuk Invisible Pagination (maksimal 3 item per halaman)
/// yang digunakan bersama oleh Dashboard dan Task History di iOS.
public enum InvisibleDeckPagerMath {
    public static let defaultPageSize: Int = 3

    /// Memecah koleksi item menjadi halaman-halaman berukuran maksimal `pageSize` (default: 3).
    public static func chunkPages<T>(_ items: [T], pageSize: Int = defaultPageSize) -> [[T]] {
        let safeSize = max(1, pageSize)
        guard !items.isEmpty else { return [] }
        var pages: [[T]] = []
        pages.reserveCapacity((items.count + safeSize - 1) / safeSize)
        var index = 0
        while index < items.count {
            let end = min(index + safeSize, items.count)
            pages.append(Array(items[index..<end]))
            index = end
        }
        return pages
    }

    /// Menghitung jumlah total halaman.
    public static func totalPages(itemCount: Int, pageSize: Int = defaultPageSize) -> Int {
        let safeSize = max(1, pageSize)
        guard itemCount > 0 else { return 1 }
        return (itemCount + safeSize - 1) / safeSize
    }

    /// Menjaga indeks halaman tetap berada di dalam rentang valid `0...(totalPages - 1)`.
    public static func clampPageIndex(_ pageIndex: Int, itemCount: Int, pageSize: Int = defaultPageSize) -> Int {
        let total = totalPages(itemCount: itemCount, pageSize: pageSize)
        return min(max(0, pageIndex), max(0, total - 1))
    }

    /// Menghasilkan teks indikator rentang item yang sedang tampil (contoh: `"1–3 dari 8"`).
    public static func rangeSummaryText(pageIndex: Int, itemCount: Int, pageSize: Int = defaultPageSize) -> String {
        guard itemCount > 0 else { return "0 tugas" }
        let safeSize = max(1, pageSize)
        let clamped = clampPageIndex(pageIndex, itemCount: itemCount, pageSize: safeSize)
        let start = clamped * safeSize + 1
        let end = min(itemCount, (clamped + 1) * safeSize)
        if start == end {
            return "\(start) dari \(itemCount)"
        }
        return "\(start)–\(end) dari \(itemCount)"
    }

    /// Mengevaluasi apakah gestur drag horizontal memenuhi syarat perpindahan halaman deck:
    /// - Harus dominan horizontal (`abs(dx) > abs(dy) * 1.35`) agar tidak mengganggu scroll vertikal.
    /// - Harus melampaui ambang jarak atau kecepatan prediksi.
    /// Mengembalikan `-1` (halaman sebelumnya), `1` (halaman berikutnya), atau `0` (batal).
    public static func evaluateDeckSwipeDirection(
        translationWidth: CGFloat,
        translationHeight: CGFloat,
        predictedEndWidth: CGFloat,
        currentPage: Int,
        totalPages: Int,
        distanceThreshold: CGFloat = 44.0
    ) -> Int {
        guard totalPages > 1 else { return 0 }
        let absX = abs(translationWidth)
        let absY = abs(translationHeight)

        // Kunci arah: abaikan jika gerakan lebih condong vertikal
        guard absX > absY * 1.35 else { return 0 }

        let effectiveDelta = abs(predictedEndWidth) > absX ? predictedEndWidth : translationWidth
        if effectiveDelta <= -distanceThreshold && currentPage < totalPages - 1 {
            return 1
        }
        if effectiveDelta >= distanceThreshold && currentPage > 0 {
            return -1
        }
        return 0
    }
}

/// Komponen **Invisible Pagination** ("Content Deck Transition") untuk menampilkan daftar tugas
/// dengan batas ketat maksimal 3 tugas per halaman, indikator posisi minimalis, kontrol inline,
/// dan navigasi geser horizontal yang tidak bentrok dengan scroll vertikal maupun swipe-action kartu.
public struct InvisibleTaskPager<Item: Identifiable, RowContent: View>: View {
    public let items: [Item]
    @Binding public var currentPage: Int
    public let pageSize: Int
    public let sectionAccessibilityId: String
    public let rowContent: (Item) -> RowContent

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var transitionDirection: Int = 1

    public init(
        items: [Item],
        currentPage: Binding<Int>,
        pageSize: Int = InvisibleDeckPagerMath.defaultPageSize,
        sectionAccessibilityId: String = "InvisibleTaskPager",
        @ViewBuilder rowContent: @escaping (Item) -> RowContent
    ) {
        self.items = items
        self._currentPage = currentPage
        self.pageSize = max(1, pageSize)
        self.sectionAccessibilityId = sectionAccessibilityId
        self.rowContent = rowContent
    }

    private var pages: [[Item]] {
        InvisibleDeckPagerMath.chunkPages(items, pageSize: pageSize)
    }

    private var totalPages: Int {
        max(1, pages.count)
    }

    private var safePageIndex: Int {
        InvisibleDeckPagerMath.clampPageIndex(currentPage, itemCount: items.count, pageSize: pageSize)
    }

    private var currentSlice: [Item] {
        guard !pages.isEmpty else { return [] }
        return pages[safePageIndex]
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Spacing.sm) {
            // Deck kartu (maksimal 3 kartu per halaman)
            VStack(spacing: AppTheme.Spacing.sm) {
                ForEach(currentSlice) { item in
                    rowContent(item)
                }
            }
            .id("\(sectionAccessibilityId)-page-\(safePageIndex)")
            .transition(deckPageTransition)

            // Bar navigasi Invisible Pagination (hanya tampil jika total item > pageSize)
            if totalPages > 1 {
                deckInlineNavigator
            }
        }
        .onChange(of: items.count) { _, newCount in
            let clamped = InvisibleDeckPagerMath.clampPageIndex(currentPage, itemCount: newCount, pageSize: pageSize)
            if clamped != currentPage {
                currentPage = clamped
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(sectionAccessibilityId)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment:
                goToPage(safePageIndex + 1)
            case .decrement:
                goToPage(safePageIndex - 1)
            @unknown default:
                break
            }
        }
    }

    // MARK: - Inline Deck Navigator (Swipe Strip + Pill Dots + Prev/Next Buttons)

    private var deckInlineNavigator: some View {
        HStack(spacing: AppTheme.Spacing.sm) {
            // Rentang item (contoh: "1–3 dari 8")
            Text(InvisibleDeckPagerMath.rangeSummaryText(
                pageIndex: safePageIndex,
                itemCount: items.count,
                pageSize: pageSize
            ))
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .foregroundStyle(AppTheme.Colors.textSecondary)
            .accessibilityIdentifier("\(sectionAccessibilityId).rangeLabel")

            // Indikator titik kapsul
            HStack(spacing: 5) {
                ForEach(0..<totalPages, id: \.self) { index in
                    let isActive = (index == safePageIndex)
                    Button {
                        goToPage(index)
                    } label: {
                        Capsule(style: .continuous)
                            .fill(
                                isActive
                                    ? AppTheme.Colors.brandPrimary
                                    : AppTheme.Colors.textTertiary.opacity(0.32)
                            )
                            .frame(width: isActive ? 18 : 6, height: 6)
                            .animation(
                                AppTheme.Motion.resolved(AppTheme.Motion.deckPageSpring, reduceMotion: reduceMotion),
                                value: safePageIndex
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Halaman \(index + 1) dari \(totalPages)")
                    .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : [.isButton])
                }
            }

            Spacer(minLength: 4)

            // Petunjuk swipe halus + tombol aksesibel < >
            HStack(spacing: 4) {
                Button {
                    goToPage(safePageIndex - 1)
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(
                            safePageIndex > 0
                                ? AppTheme.Colors.textPrimary
                                : AppTheme.Colors.textTertiary.opacity(0.38)
                        )
                        .frame(width: 34, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(AppTheme.Colors.surfaceSecondary.opacity(0.85))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .strokeBorder(AppTheme.Colors.borderSubtle, lineWidth: 1)
                        )
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(safePageIndex <= 0)
                .accessibilityIdentifier("\(sectionAccessibilityId).prevButton")
                .accessibilityLabel("Tiga tugas sebelumnya")

                Button {
                    goToPage(safePageIndex + 1)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(
                            safePageIndex < totalPages - 1
                                ? AppTheme.Colors.textPrimary
                                : AppTheme.Colors.textTertiary.opacity(0.38)
                        )
                        .frame(width: 34, height: 30)
                        .background(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .fill(AppTheme.Colors.surfaceSecondary.opacity(0.85))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .strokeBorder(AppTheme.Colors.borderSubtle, lineWidth: 1)
                        )
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(safePageIndex >= totalPages - 1)
                .accessibilityIdentifier("\(sectionAccessibilityId).nextButton")
                .accessibilityLabel("Tiga tugas berikutnya")
            }
        }
        .padding(.horizontal, AppTheme.Spacing.sm)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: AppTheme.Radius.md, style: .continuous)
                .fill(AppTheme.Colors.surfacePrimary.opacity(0.65))
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Radius.md, style: .continuous)
                .strokeBorder(AppTheme.Colors.borderSubtle.opacity(0.65), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .highPriorityGesture(
            DragGesture(minimumDistance: 18, coordinateSpace: .local)
                .onEnded { value in
                    let delta = InvisibleDeckPagerMath.evaluateDeckSwipeDirection(
                        translationWidth: value.translation.width,
                        translationHeight: value.translation.height,
                        predictedEndWidth: value.predictedEndTranslation.width,
                        currentPage: safePageIndex,
                        totalPages: totalPages
                    )
                    if delta != 0 {
                        goToPage(safePageIndex + delta)
                    }
                }
        )
    }

    // MARK: - Transitions & Navigation

    private var deckPageTransition: AnyTransition {
        if reduceMotion {
            return .opacity
        }
        let insertionEdge: Edge = transitionDirection >= 0 ? .trailing : .leading
        let removalEdge: Edge = transitionDirection >= 0 ? .leading : .trailing
        return .asymmetric(
            insertion: .move(edge: insertionEdge).combined(with: .opacity),
            removal: .move(edge: removalEdge).combined(with: .opacity)
        )
    }

    private func goToPage(_ targetPage: Int) {
        let clamped = InvisibleDeckPagerMath.clampPageIndex(targetPage, itemCount: items.count, pageSize: pageSize)
        guard clamped != safePageIndex else { return }

        transitionDirection = clamped > safePageIndex ? 1 : -1
        HapticsHelper.selectionChanged()

        let animation = AppTheme.Motion.resolved(AppTheme.Motion.deckPageSpring, reduceMotion: reduceMotion)
            ?? .linear(duration: 0.01)
        withAnimation(animation) {
            currentPage = clamped
        }
    }
}

