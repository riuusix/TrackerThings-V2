import SwiftUI

public struct TaskFormSheet: View {
    @Bindable var viewModel: DashboardViewModel
    public var defaultCourseId: Int? = nil
    @Environment(\.dismiss) private var dismiss

    @State private var namaTugas: String = ""
    @State private var idJadwal: Int = 0
    @State private var deadline: Date = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var prioritas: TugasItem.PrioritasTugas = .sedang
    @State private var jenis: TugasItem.JenisTugas = .individu
    @State private var buttonState: SubmitButtonState = .idle

    public init(viewModel: DashboardViewModel, defaultCourseId: Int? = nil) {
        self.viewModel = viewModel
        self.defaultCourseId = defaultCourseId
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Detail Tugas") {
                    TextField("Nama Tugas", text: $namaTugas)

                    if !viewModel.courses.isEmpty {
                        Picker("Mata Kuliah", selection: $idJadwal) {
                            ForEach(viewModel.courses) { course in
                                Text(course.namaMatkul).tag(course.id)
                            }
                        }
                    } else {
                        Text("Belum ada mata kuliah terdaftar")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Prioritas & Jenis") {
                    Picker("Prioritas", selection: $prioritas) {
                        ForEach(TugasItem.PrioritasTugas.allCases, id: \.self) { p in
                            Text(p.rawValue).tag(p)
                        }
                    }

                    Picker("Jenis Tugas", selection: $jenis) {
                        ForEach(TugasItem.JenisTugas.allCases, id: \.self) { j in
                            Text(j.rawValue).tag(j)
                        }
                    }
                }

                Section("Tenggat Waktu") {
                    DatePicker("Deadline", selection: $deadline, displayedComponents: [.date])
                }

                if viewModel.isOffline {
                    Section {
                        Text("Kamu sedang offline. Hubungkan ke internet untuk menyimpan tugas ke server.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle(viewModel.editingTask == nil ? "Tambah Tugas" : "Edit Tugas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") {
                        viewModel.editingTask = nil
                        dismiss()
                    }
                    .disabled(buttonState.isProcessing)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        guard !buttonState.isProcessing, !viewModel.isOffline else { return }
                        buttonState = .loading("Menyimpan...")
                        Task {
                            let ok = await viewModel.saveTask(
                                namaTugas: namaTugas.trimmingCharacters(in: .whitespaces),
                                idJadwal: idJadwal,
                                deadline: deadline,
                                prioritas: prioritas,
                                jenis: jenis
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
                    .disabled(viewModel.isOffline || namaTugas.trimmingCharacters(in: .whitespaces).isEmpty || idJadwal <= 0 || buttonState.isProcessing)
                }
            }
            .onAppear {
                if let task = viewModel.editingTask {
                    namaTugas = task.namaTugas
                    idJadwal = task.idJadwal
                    deadline = task.deadline
                    prioritas = task.prioritas
                    jenis = task.jenis
                } else if let defaultId = defaultCourseId, defaultId > 0 {
                    idJadwal = defaultId
                } else if idJadwal == 0, let firstCourse = viewModel.courses.first {
                    idJadwal = firstCourse.id
                }
            }
        }
    }
}
