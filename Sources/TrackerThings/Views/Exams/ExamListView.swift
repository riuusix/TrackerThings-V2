import SwiftUI

public struct ExamListView: View {
    @Bindable var viewModel: ExamViewModel

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
                if viewModel.exams.isEmpty {
                    ContentUnavailableView(
                        "Belum Ada Ujian",
                        systemImage: "graduationcap",
                        description: Text("Jadwal Ujian Tengah Semester (UTS) atau UAS yang ditambahkan akan muncul di sini.")
                    )
                } else {
                    ForEach(viewModel.exams) { exam in
                        let diff = daysDifference(to: exam.tanggal)
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(exam.jenisUjian)
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.red.opacity(0.12))
                                    .foregroundStyle(.red)
                                    .clipShape(Capsule())

                                Spacer()

                                if diff < 0 {
                                    Text("Selesai")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                } else if diff == 0 {
                                    Text("Hari Ini!")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(.red)
                                } else {
                                    Text("\(diff) hari lagi")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.orange)
                                }
                            }

                            Text(exam.jadwal?.namaMatkul ?? "Ujian Akademik")
                                .font(.headline)

                            HStack(spacing: 12) {
                                Label(exam.tanggal.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                if let start = exam.waktuMulai {
                                    Label("\(start)\(exam.waktuSelesai.map { " - " + $0 } ?? "")", systemImage: "clock")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            if let room = exam.ruangan, !room.isEmpty {
                                Label("Ruangan: \(room)", systemImage: "mappin")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if let note = exam.catatan, !note.isEmpty {
                                Text("Catatan: \(note)")
                                    .font(.caption)
                                    .padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.secondary.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task {
                                    await viewModel.deleteExam(id: exam.id)
                                }
                            } label: {
                                Label("Hapus", systemImage: "trash")
                            }

                            Button {
                                viewModel.editingExam = exam
                                viewModel.isPresentingSheet = true
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            .tint(.orange)
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
            .refreshable {
                await viewModel.fetchExams()
            }
            .task {
                await viewModel.fetchExams()
            }
        }
    }
}

public struct ExamFormSheet: View {
    @Bindable var viewModel: ExamViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var idJadwal: Int = 0
    @State private var jenisUjian: String = "UTS"
    @State private var tanggal: Date = Date()
    @State private var waktuMulai: String = "08:00"
    @State private var waktuSelesai: String = "10:00"
    @State private var ruangan: String = ""
    @State private var catatan: String = ""

    private let jenisOptions = ["UTS", "UAS", "Kuis", "Responsi", "Praktikum"]

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
            }
            .navigationTitle(viewModel.editingExam == nil ? "Tambah Ujian" : "Edit Ujian")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Simpan") {
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
                            if ok { dismiss() }
                        }
                    }
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
                } else if let firstCourse = viewModel.courses.first {
                    idJadwal = firstCourse.id
                }
            }
        }
    }
}

