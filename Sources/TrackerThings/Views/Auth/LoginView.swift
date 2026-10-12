import SwiftUI

public struct LoginView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var username: String = ""
    @State private var password: String = ""
    @State private var isPasswordVisible: Bool = false
    @State private var isPresentingRegister: Bool = false
    #if DEBUG
    @State private var isPresentingServerSettings: Bool = false
    #endif
    @FocusState private var focusedField: Field?

    private enum Field {
        case username
        case password
    }

    public init() {}

    private var isFormValid: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                // Canonical TrackerThings Brand Header
                BrandHeaderView(subtitle: "Masuk untuk mengelola jadwal dan tugas Anda", logoSize: 76)
                    .padding(.top, 16)

                // Error Message Banner
                if let errorMessage = authViewModel.errorMessage {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                        Spacer()
                    }
                    .padding(12)
                    .background(Color.red.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }

                // Form Fields
                VStack(spacing: 16) {
                    // Username Field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Username")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)

                        HStack {
                            Image(systemName: "person.fill")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)

                            TextField("Masukkan username Anda", text: $username)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .focused($focusedField, equals: .username)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .password }
                        }
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    // Password Field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Kata Sandi")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)

                        HStack {
                            Image(systemName: "lock.fill")
                                .foregroundStyle(.secondary)
                                .frame(width: 20)

                            if isPasswordVisible {
                                TextField("Masukkan kata sandi", text: $password)
                                    .focused($focusedField, equals: .password)
                                    .submitLabel(.go)
                                    .onSubmit { handleLogin() }
                            } else {
                                SecureField("Masukkan kata sandi", text: $password)
                                    .focused($focusedField, equals: .password)
                                    .submitLabel(.go)
                                    .onSubmit { handleLogin() }
                            }

                            Button {
                                isPasswordVisible.toggle()
                            } label: {
                                Image(systemName: isPasswordVisible ? "eye.slash.fill" : "eye.fill")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(14)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }

                // Tombol Masuk
                Button {
                    handleLogin()
                } label: {
                    HStack(spacing: 8) {
                        if authViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                            Text("Masuk...")
                                .font(.headline.weight(.semibold))
                        } else {
                            Text("Masuk")
                                .font(.headline.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(isFormValid && !authViewModel.isLoading ? Color.blue : Color.blue.opacity(0.4))
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(!isFormValid || authViewModel.isLoading)

                // Navigasi ke Registrasi
                HStack(spacing: 4) {
                    Text("Belum punya akun?")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Button("Daftar Sekarang") {
                        authViewModel.clearMessages()
                        isPresentingRegister = true
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.blue)
                }
                .padding(.top, 4)

                Spacer(minLength: 20)

                #if DEBUG
                // Tombol Pengaturan Server URL (Hanya di mode Debug)
                Button {
                    isPresentingServerSettings = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "server.rack")
                        Text("Pengaturan Server API (Debug)")
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
                .padding(.bottom, 16)
                #endif
            }
            .padding(.horizontal, 24)
        }
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        .sheet(isPresented: $isPresentingRegister) {
            RegisterView()
        }
        #if DEBUG
        .sheet(isPresented: $isPresentingServerSettings) {
            ServerSettingsSheet()
        }
        #endif
    }

    private func handleLogin() {
        guard isFormValid && !authViewModel.isLoading else { return }
        focusedField = nil
        Task {
            await authViewModel.login(username: username, password: password)
        }
    }
}

