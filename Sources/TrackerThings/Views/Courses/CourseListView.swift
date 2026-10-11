import SwiftUI

public struct CourseListView: View {
    @Bindable var viewModel: CourseViewModel

    public init(viewModel: CourseViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.filteredCourses) { course in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(course.hari)
                                .font(.caption.weight(.bold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.blue.opacity(0.12))
                                .foregroundStyle(.blue)
                                .clipShape(Capsule())

                            if let kat = course.kategori, !kat.isEmpty {
                                Text(kat)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.secondary.opacity(0.12))
                                    .foregroundStyle(.secondary)
                                    .clipShape(Capsule())
                            }

                            Spacer()
                        }

                        Text(course.namaMatkul)
                            .font(.headline)

                        HStack(spacing: 12) {
                            Label("\(course.waktuMulai) - \(course.waktuSelesai)", systemImage: "clock")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            if let room = course.lokasi, !room.isEmpty {
                                Label(room, systemImage: "mappin")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if let dos = course.dosen, !dos.isEmpty {
                            Label("Dosen: \(dos)", systemImage: "person.circle")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task {
                                await viewModel.deleteCourse(id: course.id)
                            }
                        } label: {
                            Label("Hapus", systemImage: "trash")
                        }

                        Button {
                            viewModel.editingCourse = course
                            viewModel.isPresentingSheet = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        .tint(.orange)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Mata Kuliah")
            .searchable(text: $viewModel.searchText, prompt: "Cari mata kuliah, dosen, atau hari...")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.editingCourse = nil
                        viewModel.isPresentingSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.isPresentingSheet) {
                CourseFormSheet(viewModel: viewModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .refreshable {
                await viewModel.fetchCourses()
            }
            .task {
                await viewModel.fetchCourses()
            }
        }
    }
}

public struct CourseFormSheet: View {
    @Bindable var viewModel: CourseViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var namaMatkul: String = ""
    @State private var dosen: String = ""
    @State private var hari: String = "Senin"
    @State private var kategori: String = "Wajib"
    @State private var waktuMulai: String = "08:00"
    @State private var waktuSelesai: String = "09:40"
    @State private var lokasi: String = ""

    private let hariOptions = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    private let kategoriOptions = ["Wajib", "Pilihan", "Praktikum", "Umum"]

    public var body: some View {
        NavigationStack {
            Form {
                Section("Informasi Kuliah") {
                    TextField("Nama Mata Kuliah", text: $namaMatkul)
                    TextField("Dosen Pengampu", text: $dosen)
                    TextField("Ruangan / Lokasi", text: $lokasi)
                }

                Section("Jadwal & Kategori") {
                    Picker("Hari", selection: $hari) {
                        ForEach(hariOptions, id: \.self) {
                            Text($0).tag($0)
                        }
                    }

                    Picker("Kategori", selection: $kategori) {
                        ForEach(kategoriOptions, id: \.self) {
                            Text($0).tag($0)
                        }
                    }

                    HStack {
                        Text("Mulai")
                        Spacer()
                        TextField("08:00", text: $waktuMulai)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Selesai")
                        Spacer()
                        TextField("09:40", text: $waktuSelesai)
                            .multilineTextAlignment(.trailing)
                    }
                }
            }
            .navigationTitle(viewModel.editingCourse == nil ? "Tambah Kuliah" : "Edit Kuliah")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Simpan") {
                        Task {
                            let ok = await viewModel.saveCourse(
                                namaMatkul: namaMatkul,
                                dosen: dosen.isEmpty ? nil : dosen,
                                kategori: kategori,
                                lokasi: lokasi.isEmpty ? nil : lokasi,
                                hari: hari,
                                waktuMulai: waktuMulai,
                                waktuSelesai: waktuSelesai
                            )
                            if ok { dismiss() }
                        }
                    }
                    .disabled(namaMatkul.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let course = viewModel.editingCourse {
                    namaMatkul = course.namaMatkul
                    dosen = course.dosen ?? ""
                    hari = course.hari
                    kategori = course.kategori ?? "Wajib"
                    waktuMulai = course.waktuMulai
                    waktuSelesai = course.waktuSelesai
                    lokasi = course.lokasi ?? ""
                }
            }
        }
    }
}

