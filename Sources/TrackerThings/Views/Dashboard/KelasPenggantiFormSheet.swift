import SwiftUI

/// Modal sheet untuk menambah data Kelas Pengganti dengan validasi form,
/// state submit yang terlindungi dari double tap, dan transisi animasi loading -> checkmark.
public struct KelasPenggantiFormSheet: View {
    @Bindable var viewModel: DashboardViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var idJadwal: Int = 0
    @State private var tanggal: Date = Date()
    @State private var waktuMulai: String = "08:00"
    @State private var waktuSelesai: String = "09:40"
    @State private var lokasi: String = ""
    @State private var catatan: String = ""
    @State private var buttonState: SubmitButtonState = .idle

    public init(viewModel: DashboardViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section("Mata Kuliah") {
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

                Section("Waktu & Tanggal") {
                    DatePicker("Tanggal", selection: $tanggal, displayedComponents: [.date])

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

                Section("Lokasi & Catatan (Opsional)") {
                    TextField("Ruangan / Platform (mis. R.302 / Zoom)", text: $lokasi)
                    TextField("Catatan pengganti...", text: $catatan, axis: .vertical)
                        .lineLimit(2...4)
                }

                if viewModel.isOffline {
                    Section {
                        Text("Kamu sedang offline. Hubungkan ke internet untuk menambahkan kelas pengganti baru ke server.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle("Kelas Pengganti")
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
                            let ok = await viewModel.saveKelasPengganti(
                                idJadwal: idJadwal,
                                tanggal: tanggal,
                                waktuMulai: waktuMulai.trimmingCharacters(in: .whitespaces),
                                waktuSelesai: waktuSelesai.trimmingCharacters(in: .whitespaces),
                                lokasi: lokasi.trimmingCharacters(in: .whitespaces).isEmpty ? nil : lokasi.trimmingCharacters(in: .whitespaces),
                                catatan: catatan.trimmingCharacters(in: .whitespaces).isEmpty ? nil : catatan.trimmingCharacters(in: .whitespaces)
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
                    .disabled(
                        viewModel.isOffline ||
                        idJadwal <= 0 ||
                        waktuMulai.trimmingCharacters(in: .whitespaces).isEmpty ||
                        waktuSelesai.trimmingCharacters(in: .whitespaces).isEmpty ||
                        buttonState.isProcessing
                    )
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

