import SwiftUI

/// Modal sheet untuk mengatur Base URL server API, berguna untuk development dengan iPhone fisik di jaringan lokal.
public struct ServerSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var urlInput: String = ""
    private var config = AppConfig.shared

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Server API URL", text: $urlInput)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)

                    if !urlInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        HStack {
                            Text("Akan digunakan:")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(AppConfig.normalizeURLString(urlInput))
                                .font(.caption2.monospaced())
                                .foregroundStyle(.blue)
                        }
                    }
                } header: {
                    Text("Alamat Server Backend")
                } footer: {
                    Text("Untuk iPhone fisik, masukkan IP lokal komputer Anda (misal 192.168.1.15:3000 atau http://192.168.1.15:3000/api). Jalur /api akan otomatis disesuaikan.")
                        .font(.footnote)
                }

                Section {
                    Button("Gunakan Default (localhost)") {
                        urlInput = AppConfig.defaultServerURL
                    }
                    .foregroundStyle(.blue)
                }
            }
            .navigationTitle("Konfigurasi Server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Batal") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Simpan") {
                        let trimmed = urlInput.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            config.serverURLString = trimmed
                        }
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                urlInput = config.serverURLString
            }
        }
        .presentationDetents([.medium])
    }
}

