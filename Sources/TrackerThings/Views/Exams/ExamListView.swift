import SwiftUI

public struct ExamListView: View {
    @Bindable var viewModel: ExamViewModel
    @State private var examPendingDeletion: UjianItem? = nil

    public init(viewModel: ExamViewModel) {
        self.viewModel = viewModel
    }

    private func daysDifference(to target: Date) -> Int {
        let calendar = Calendar.current
        let start1 = calendar.startOfDay(for: Date())
        let start2 = calendar.startOfDay(for: target)
        return calendar.dateComponents([.day], from: start1, to: start2).day ?? 0
    }

    public var body: some View {
        NavigationStack {
            List {
                if viewModel.isOffline {
                    Section {
                        OfflineBannerView(
                            lastUpdatedText: viewModel.lastCacheDateText
                        ) {
                            Task {
                                await viewModel.fetchExams()
                            }
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                if viewModel.isLoading && viewModel.exams.isEmpty {
                    Section {
                        SkeletonRowView()
                        SkeletonRowView()
                        SkeletonRowView()
                    }
                } else if let error = viewModel.errorMessage, viewModel.exams.isEmpty {
                    Section {
                        ErrorRetryView(
                            title: "Gagal Memuat Jadwal Ujian",
                            message: error
                        ) {
                            await viewModel.fetchExams()
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                } else if viewModel.exams.isEmpty {
                    ContentUnavailableView(
                        "Belum Ada Ujian",
                        systemImage: "graduationcap",
                        description: Text("Jadwal Ujian Tengah Semester (UTS) atau UAS yang ditambahkan akan muncul di sini.")
                    )
                } else {
                    let upcoming = viewModel.exams.filter { daysDifference(to: $0.tanggal) >= 0 }.sorted { $0.tanggal < $1.tanggal }
                    let past = viewModel.exams.filter { daysDifference(to: $0.tanggal) < 0 }.sorted { $0.tanggal > $1.tanggal }

                    if !upcoming.isEmpty {
                        Section {
                            ForEach(upcoming) { exam in
                                examRow(for: exam)
                            }
                        } header: {
                            HStack {
                                Text("Akan Datang")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.textPrimary)
                                Spacer()
                                Text("\(upcoming.count) Ujian")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                    .monospacedDigit()
                            }
                        }
                    }

                    if !past.isEmpty {
                        Section {
                            ForEach(past) { exam in
                                examRow(for: exam)
                            }
                        } header: {
                            HStack {
                                Text("Riwayat Ujian")
                                    .font(AppTheme.Typography.sectionHeader)
                                    .foregroundStyle(AppTheme.Colors.textSecondary)
                                Spacer()
                                Text("\(past.count) Selesai")
                                    .font(AppTheme.Typography.caption)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                    .monospacedDigit()
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Jadwal Ujian")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.editingExam = nil
                        viewModel.isPresentingSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.isPresentingSheet) {
                ExamFormSheet(viewModel: viewModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .confirmationDialog(
                "Hapus Jadwal Ujian?",
                isPresented: Binding(
                    get: { examPendingDeletion != nil },
                    set: { if !$0 { examPendingDeletion = nil } }
                ),
                titleVisibility: .visible,
                presenting: examPendingDeletion
            ) { exam in
                Button("Hapus Ujian", role: .destructive) {
                    Task {
                        await viewModel.deleteExam(id: exam.id)
                    }
                }
                Button("Batal", role: .cancel) {
                    examPendingDeletion = nil
                }
            } message: { exam in
                let courseName = exam.jadwal?.namaMatkul ?? "Mata Kuliah"
                Text("Jadwal \(exam.jenisUjian) untuk \(courseName) akan dihapus secara permanen.")
            }
            .refreshable {
                await viewModel.fetchExams()
            }
            .task {
                await viewModel.fetchExams()
            }
            .feedbackToast(toast: $viewModel.toast)
        }
    }

    private func examMonthText(_ date: Date) -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "id_ID")
        df.dateFormat = "MMM"
        return df.string(from: date)
    }

    private func examDayText(_ date: Date) -> String {
        let df = DateFormatter()
        df.dateFormat = "d"
        return df.string(from: date)
    }

    @ViewBuilder
    private func countdownBadge(diff: Int) -> some View {
        if diff < 0 {
            Text("Selesai")
                .font(.system(size: 8, weight: .medium))
                .foregroundStyle(AppTheme.Colors.textTertiary)
        } else if diff == 0 {
            Text("Hari Ini")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(AppTheme.Colors.urgent)
        } else {
            Text("\(diff) hari")
                .font(.system(size: 8, weight: .semibold))
                .foregroundStyle(diff <= 3 ? AppTheme.Colors.urgent : AppTheme.Colors.warning)
        }
    }

    private func examBadgeBg(diff: Int) -> Color {
        if diff < 0 { return AppTheme.Colors.neutralBackground }
        if diff == 0 { return AppTheme.Colors.urgentBackground }
        return AppTheme.Colors.infoBackground
    }

    private func examBadgeFg(diff: Int) -> Color {
        if diff < 0 { return AppTheme.Colors.textTertiary }
        if diff == 0 { return AppTheme.Colors.urgent }
        return AppTheme.Colors.brandPrimary
    }

    @ViewBuilder
    private func examRow(for exam: UjianItem) -> some View {
        let diff = daysDifference(to: exam.tanggal)
        NavigationLink {
            ExamDetailView(
                examId: exam.id,
                initialExam: exam,
                viewModel: viewModel
            )
        } label: {
            HStack(alignment: .top, spacing: AppTheme.Metrics.spacingMedium) {
                // Left Chronological Date Block
                VStack(spacing: 2) {
                    Text(examMonthText(exam.tanggal))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(diff < 0 ? AppTheme.Colors.textTertiary : AppTheme.Colors.brandPrimary)
                        .textCase(.uppercase)

                    Text(examDayText(exam.tanggal))
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(diff < 0 ? AppTheme.Colors.textTertiary : AppTheme.Colors.textPrimary)
                        .monospacedDigit()

                    countdownBadge(diff: diff)
                }
                .frame(width: 52)
                .padding(.vertical, 4)
                .padding(.horizontal, 4)
                .background(AppTheme.Colors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AppTheme.Metrics.cornerRadiusSmall, style: .continuous)
                        .stroke(AppTheme.Colors.borderSubtle, lineWidth: 0.5)
                )

                // Exam Info Content
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text(exam.jenisUjian)
                            .font(AppTheme.Typography.badge)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(examBadgeBg(diff: diff))
                            .foregroundStyle(examBadgeFg(diff: diff))
                            .clipShape(Capsule())

                        Spacer()
                    }

                    Text(exam.jadwal?.namaMatkul ?? "Ujian Akademik")
                        .font(AppTheme.Typography.cardTitle)
                        .foregroundStyle(AppTheme.Colors.textPrimary)
                        .lineLimit(2)

                    HStack(spacing: 12) {
                        if let start = exam.waktuMulai {
                            Label("\(start)\(exam.waktuSelesai.map { " - " + $0 } ?? "")", systemImage: "clock")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textSecondary)
                                .monospacedDigit()
                        }

                        if let room = exam.ruangan, !room.isEmpty {
                            Label(room, systemImage: "mappin")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(AppTheme.Colors.textTertiary)
                                .lineLimit(1)
                        }
                    }

                    if let note = exam.catatan, !note.isEmpty {
                        Text(note)
                            .font(AppTheme.Typography.caption)
                            .foregroundStyle(AppTheme.Colors.textSecondary)
                            .lineLimit(2)
                            .padding(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.Colors.neutralBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    }
                }
            }
            .padding(.vertical, 3)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                examPendingDeletion = exam
            } label: {
                Label("Hapus", systemImage: "trash")
            }

            Button {
                viewModel.editingExam = exam
                viewModel.isPresentingSheet = true
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            .tint(AppTheme.Colors.warning)
        }
    }
}

public struct ExamFormSheet: View {
    @Bindable var viewModel: ExamViewModel
    public var defaultCourseId: Int? = nil
    @Environment(\.dismiss) private var dismiss

    @State private var idJadwal: Int = 0
    @State private var jenisUjian: String = "UTS"
    @State private var tanggal: Date = Date()
    @State private var waktuMulai: String = "08:00"
    @State private var waktuSelesai: String = "10:00"
    @State private var ruangan: String = ""
    @State private var catatan: String = ""
    @State private var buttonState: SubmitButtonState = .idle

    private let jenisOptions = ["UTS", "UAS", "Kuis", "Responsi", "Praktikum"]

    public init(viewModel: ExamViewModel, defaultCourseId: Int? = nil) {
        self.viewModel = viewModel
        self.defaultCourseId = defaultCourseId
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Mata Kuliah & Jenis Evaluasi") {
                    if !viewModel.courses.isEmpty {
                        Picker("Mata Kuliah", selection: $idJadwal) {
                            ForEach(viewModel.courses) { c in
                                Text(c.namaMatkul).tag(c.id)
                            }
                        }
                    }

                    Picker("Jenis Ujian", selection: $jenisUjian) {
                        ForEach(jenisOptions, id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                }

                Section("Jadwal & Lokasi") {
                    DatePicker("Tanggal Ujian", selection: $tanggal, displayedComponents: .date)

                    HStack {
                        Text("Mulai")
                        Spacer()
                        TextField("08:00", text: $waktuMulai)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Selesai")
                        Spacer()
                        TextField("10:00", text: $waktuSelesai)
                            .multilineTextAlignment(.trailing)
                    }

                    TextField("Ruangan / Platform", text: $ruangan)
                }

                Section("Materi / Catatan") {
                    TextField("Bab materi, ketentuan bawa kalkulator, dsb.", text: $catatan, axis: .vertical)
                        .lineLimit(3...5)
                }

                if viewModel.isOffline {
                    Section {
                        Text("Kamu sedang offline. Hubungkan ke internet untuk menyimpan jadwal ujian ke server.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle(viewModel.editingExam == nil ? "Tambah Ujian" : "Edit Ujian")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") {
                        viewModel.editingExam = nil
                        dismiss()
                    }
                    .disabled(buttonState.isProcessing)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !buttonState.isProcessing, !viewModel.isOffline else { return }
                        buttonState = .loading("Menyimpan...")
                        Task {
                            let ok = await viewModel.saveExam(
                                idJadwal: idJadwal,
                                jenisUjian: jenisUjian,
                                tanggal: tanggal,
                                waktuMulai: waktuMulai.isEmpty ? nil : waktuMulai,
                                waktuSelesai: waktuSelesai.isEmpty ? nil : waktuSelesai,
                                ruangan: ruangan.isEmpty ? nil : ruangan,
                                catatan: catatan.isEmpty ? nil : catatan
                            )
                            if ok {
                                buttonState = .success("Tersimpan")
                                try? await Task.sleep(nanoseconds: 500_000_000)
                                dismiss()
                            } else {
                                buttonState = .idle
                            }
                        }
                    } label: {
                        SubmitButtonLabel(state: buttonState, idleTitle: "Simpan")
                    }
                    .disabled(viewModel.isOffline || idJadwal <= 0 || buttonState.isProcessing)
                }
            }
            .onAppear {
                if let exam = viewModel.editingExam {
                    idJadwal = exam.idJadwal
                    jenisUjian = exam.jenisUjian
                    tanggal = exam.tanggal
                    waktuMulai = exam.waktuMulai ?? "08:00"
                    waktuSelesai = exam.waktuSelesai ?? "10:00"
                    ruangan = exam.ruangan ?? ""
                    catatan = exam.catatan ?? ""
                } else if let defaultId = defaultCourseId, defaultId > 0 {
                    idJadwal = defaultId
                } else if let firstCourse = viewModel.courses.first {
                    idJadwal = firstCourse.id
                }
            }
        }
    }
}

