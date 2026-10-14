import SwiftUI

public struct CourseListView: View {
    @Bindable var viewModel: CourseViewModel
    @State private var coursePendingDeletion: JadwalItem? = nil

    public init(viewModel: CourseViewModel) {
        self.viewModel = viewModel
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
                                await viewModel.fetchCourses()
                            }
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                }

                if viewModel.isLoading && viewModel.courses.isEmpty {
                    Section {
                        SkeletonRowView()
                        SkeletonRowView()
                        SkeletonRowView()
                    }
                } else if let error = viewModel.errorMessage, viewModel.courses.isEmpty {
                    Section {
                        ErrorRetryView(
                            title: "Gagal Memuat Mata Kuliah",
                            message: error
                        ) {
                            await viewModel.fetchCourses()
                        }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                    }
                } else if viewModel.courses.isEmpty {
                    ContentUnavailableView(
                        "Belum Ada Mata Kuliah",
                        systemImage: "book.closed",
                        description: Text("Tambahkan mata kuliah untuk semester aktif melalui tombol tambah di atas.")
                    )
                } else if viewModel.filteredCourses.isEmpty {
                    ContentUnavailableView.search(text: viewModel.searchText)
                } else {
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
                                coursePendingDeletion = course
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
            .confirmationDialog(
                "Hapus Mata Kuliah?",
                isPresented: Binding(
                    get: { coursePendingDeletion != nil },
                    set: { if !$0 { coursePendingDeletion = nil } }
                ),
                titleVisibility: .visible,
                presenting: coursePendingDeletion
            ) { course in
                Button("Hapus \(course.namaMatkul)", role: .destructive) {
                    Task {
                        await viewModel.deleteCourse(id: course.id)
                    }
                }
                Button("Batal", role: .cancel) {
                    coursePendingDeletion = nil
                }
            } message: { course in
                Text("Mata kuliah \"\(course.namaMatkul)\" beserta seluruh data terkait akan dihapus secara permanen.")
            }
            .refreshable {
                await viewModel.fetchCourses()
            }
            .task {
                await viewModel.fetchCourses()
            }
            .feedbackToast(toast: $viewModel.toast)
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
    @State private var buttonState: SubmitButtonState = .idle

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

                if viewModel.isOffline {
                    Section {
                        Text("Kamu sedang offline. Hubungkan ke internet untuk menyimpan perubahan mata kuliah ke server.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
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
                    .disabled(buttonState.isProcessing)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !buttonState.isProcessing, !viewModel.isOffline else { return }
                        buttonState = .loading("Menyimpan...")
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
                    .disabled(viewModel.isOffline || namaMatkul.trimmingCharacters(in: .whitespaces).isEmpty || buttonState.isProcessing)
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

