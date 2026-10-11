import SwiftUI

public struct TaskFormSheet: View {
    @Bindable var viewModel: DashboardViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var namaTugas: String = ""
    @State private var idJadwal: Int = 0
    @State private var deadline: Date = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
    @State private var prioritas: TugasItem.PrioritasTugas = .sedang
    @State private var jenis: TugasItem.JenisTugas = .individu
    @State private var isSubmitting: Bool = false

    public init(viewModel: DashboardViewModel) {
        self.viewModel = viewModel
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
                    DatePicker("Deadline", selection: $deadline, displayedComponents: [.date, .hourAndMinute])
                }
            }
            .navigationTitle("Tambah Tugas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Simpan") {
                        isSubmitting = true
                        Task {
                            let ok = await viewModel.saveTask(
                                namaTugas: namaTugas.trimmingCharacters(in: .whitespaces),
                                idJadwal: idJadwal,
                                deadline: deadline,
                                prioritas: prioritas,
                                jenis: jenis
                            )
                            isSubmitting = false
                            if ok {
                                dismiss()
                            }
                        }
                    }
                    .disabled(namaTugas.trimmingCharacters(in: .whitespaces).isEmpty || idJadwal <= 0 || isSubmitting)
                }
            }
            .onAppear {
                if idJadwal == 0, let firstCourse = viewModel.courses.first {
                    idJadwal = firstCourse.id
                }
            }
        }
    }
}
