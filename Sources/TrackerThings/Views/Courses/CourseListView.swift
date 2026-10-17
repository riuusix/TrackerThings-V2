import SwiftUI

/// Tampilan daftar Mata Kuliah TrackerThings V2.
/// Mengadopsi hierarki visual AppTheme, pencarian cepat, swipe action asli iOS,
/// penanganan status offline, dan form penambahan/pengubahan kuliah.
public struct CourseListView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Bindable var viewModel: CourseViewModel
    @State private var dashboardViewModel: DashboardViewModel
    @State private var examViewModel: ExamViewModel
    @State private var coursePendingDeletion: JadwalItem? = nil
    @State private var isShowingAccountSummary: Bool = false
    @State private var isShowingImportSchedule: Bool = false

    public init(
        viewModel: CourseViewModel,
        dashboardViewModel: DashboardViewModel = DashboardViewModel(),
        examViewModel: ExamViewModel = ExamViewModel()
    ) {
        self.viewModel = viewModel
        _dashboardViewModel = State(initialValue: dashboardViewModel)
        _examViewModel = State(initialValue: examViewModel)
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
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                }

                if viewModel.isLoading && viewModel.courses.isEmpty {
                    Section {
                        ForEach(0..<4, id: \.self) { _ in
                            SkeletonCardView()
                                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        }
                    }
                } else if let error = viewModel.errorMessage, viewModel.courses.isEmpty {
                    Section {
                        ErrorRetryView(
                            title: "Gagal Memuat Mata Kuliah",
                            message: error
                        ) {
                            await viewModel.fetchCourses()
                        }
                        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                } else if viewModel.courses.isEmpty {
                    Section {
                        ContentUnavailableView(
                            "Belum Ada Mata Kuliah",
                            systemImage: "book.closed",
                            description: Text("Tambahkan mata kuliah untuk semester aktif melalui tombol tambah di atas.")
                        )
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                } else if viewModel.filteredCourses.isEmpty {
                    Section {
                        ContentUnavailableView.search(text: viewModel.searchText)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                } else {
                    Section {
                        ForEach(viewModel.filteredCourses) { course in
                            ZStack {
                                NavigationLink {
                                    CourseDetailView(
                                        courseId: course.id,
                                        initialCourse: course,
                                        courseViewModel: viewModel,
                                        dashboardViewModel: dashboardViewModel,
                                        examViewModel: examViewModel
                                    )
                                } label: {
                                    EmptyView()
                                }
                                .opacity(0)

                                CourseCardView(
                                    course: course,
                                    onEdit: {
                                        viewModel.editingCourse = course
                                        viewModel.isPresentingSheet = true
                                    },
                                    onDelete: {
                                        coursePendingDeletion = course
                                    }
                                )
                            }
                            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
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
                    } header: {
                        if !viewModel.filteredCourses.isEmpty {
                            HStack {
                                Text("\(viewModel.filteredCourses.count) MATA KULIAH")
                                    .font(AppTheme.Typography.badge)
                                    .foregroundStyle(AppTheme.Colors.textTertiary)
                                Spacer()
                            }
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 4, trailing: 16))
                        }
                    }
                }
            }
            .listStyle(.plain)
            .background(AppTheme.Colors.background)
            .navigationTitle("Mata Kuliah")
            .searchable(text: $viewModel.searchText, prompt: "Cari mata kuliah, dosen, atau hari...")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        isShowingAccountSummary = true
                    } label: {
                        UserAccountStatusBadge(size: 30)
                            .frame(
                                width: AppTheme.Metrics.minTouchTarget,
                                height: AppTheme.Metrics.minTouchTarget,
                                alignment: .leading
                            )
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Profil dan Status Akun")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            viewModel.editingCourse = nil
                            viewModel.isPresentingSheet = true
                        } label: {
                            Label("Tambah Manual", systemImage: "plus")
                        }

                        Button {
                            isShowingImportSchedule = true
                        } label: {
                            Label("Impor Jadwal (Foto/PDF)", systemImage: "doc.viewfinder")
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .semibold))
                            .frame(
                                width: AppTheme.Metrics.minTouchTarget,
                                height: AppTheme.Metrics.minTouchTarget,
                                alignment: .trailing
                            )
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Opsi Tambah atau Impor Mata Kuliah")
                }
            }
            .sheet(isPresented: $isShowingAccountSummary) {
                UserAccountSummarySheet()
            }
            .sheet(isPresented: $viewModel.isPresentingSheet) {
                CourseFormSheet(viewModel: viewModel)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $isShowingImportSchedule) {
                ImportScheduleView(courseViewModel: viewModel)
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

    public init(viewModel: CourseViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Informasi Kuliah") {
                    TextField("Nama Mata Kuliah (Wajib)", text: $namaMatkul)
                        .textContentType(.name)
                        .autocorrectionDisabled()

                    TextField("Dosen Pengampu (Opsional)", text: $dosen)
                        .autocorrectionDisabled()

                    TextField("Ruangan / Lokasi (Contoh: Lab 2, R.304)", text: $lokasi)
                        .autocorrectionDisabled()
                }

                Section("Jadwal & Kategori") {
                    Picker("Hari Kuliah", selection: $hari) {
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
                        Text("Jam Mulai")
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Spacer()
                        TextField("08:00", text: $waktuMulai)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numbersAndPunctuation)
                            .frame(minWidth: 80)
                    }

                    HStack {
                        Text("Jam Selesai")
                            .foregroundStyle(AppTheme.Colors.textPrimary)
                        Spacer()
                        TextField("09:40", text: $waktuSelesai)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numbersAndPunctuation)
                            .frame(minWidth: 80)
                    }
                }

                if viewModel.isOffline {
                    Section {
                        HStack(spacing: 8) {
                            Image(systemName: "wifi.slash")
                                .foregroundStyle(.orange)
                            Text("Mode offline. Hubungkan ke internet untuk menyimpan ke server.")
                                .font(AppTheme.Typography.caption)
                                .foregroundStyle(.orange)
                        }
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
                    .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
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
                    .frame(minWidth: AppTheme.Metrics.minTouchTarget, minHeight: AppTheme.Metrics.minTouchTarget)
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
