import SwiftUI

public struct RegisterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var authViewModel

    @State private var username: String = ""
    @State private var email: String = ""
    @State private var fullName: String = ""
    @State private var phoneNumber: String = ""
    @State private var password: String = ""
    @State private var confirmPassword: String = ""
    @State private var isPasswordVisible: Bool = false
    @State private var localValidationMessage: String?
    @State private var isRegistrationSuccess: Bool = false

    @FocusState private var focusedField: Field?

    private enum Field {
        case username
        case email
        case fullName
        case phoneNumber
        case password
        case confirmPassword
    }

    public init() {}

    private var isFormFilled: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty &&
        !email.trimmingCharacters(in: .whitespaces).isEmpty &&
        !password.isEmpty &&
        !confirmPassword.isEmpty
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header Description with Canonical Brand
                    VStack(spacing: 8) {
                        BrandLogoView(size: 56)
                            .padding(.top, 6)

                        HStack(spacing: 0) {
                            Text("Tracker")
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                                .foregroundStyle(.primary)

                            Text("Things")
                                .font(.system(size: 22, weight: .bold, design: .rounded))
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.blue, Color(red: 0.05, green: 0.72, blue: 0.88)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                        }

                        Text("Buat akun baru untuk mulai menggunakan TrackerThings")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 8)

                    // Error Banner
                    if let errorMessage = localValidationMessage ?? authViewModel.errorMessage {
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
                    }

                    // Success Banner
                    if let successMessage = authViewModel.successMessage {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text(successMessage)
                                .font(.footnote)
                                .foregroundStyle(.green)
                            Spacer()
                        }
                        .padding(12)
                        .background(Color.green.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    // Form Input Container
                    VStack(spacing: 14) {
                        // Username
                        inputField(
                            title: "Username *",
                            placeholder: "contoh: budysantoso",
                            text: $username,
                            icon: "person.fill",
                            field: .username,
                            nextField: .email,
                            keyboardType: .default,
                            autocapitalization: false
                        )

                        // Email
                        inputField(
                            title: "Email *",
                            placeholder: "nama@kampus.ac.id",
                            text: $email,
                            icon: "envelope.fill",
                            field: .email,
                            nextField: .fullName,
                            keyboardType: .emailAddress,
                            autocapitalization: false
                        )

                        // Nama Lengkap (Opsional)
                        inputField(
                            title: "Nama Lengkap (Opsional)",
                            placeholder: "Budy Santoso",
                            text: $fullName,
                            icon: "person.text.rectangle.fill",
                            field: .fullName,
                            nextField: .phoneNumber,
                            keyboardType: .default,
                            autocapitalization: true
                        )

                        // Nomor Telepon (Opsional)
                        inputField(
                            title: "Nomor Telepon (Opsional)",
                            placeholder: "081234567890",
                            text: $phoneNumber,
                            icon: "phone.fill",
                            field: .phoneNumber,
                            nextField: .password,
                            keyboardType: .phonePad,
                            autocapitalization: false
                        )

                        // Password
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Kata Sandi * (Minimal 6 karakter)")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)

                            HStack {
                                Image(systemName: "lock.fill")
                                    .foregroundStyle(.secondary)
                                    .frame(width: 20)

                                if isPasswordVisible {
                                    TextField("Minimal 6 karakter", text: $password)
                                        .focused($focusedField, equals: .password)
                                        .submitLabel(.next)
                                        .onSubmit { focusedField = .confirmPassword }
                                } else {
                                    SecureField("Minimal 6 karakter", text: $password)
                                        .focused($focusedField, equals: .password)
                                        .submitLabel(.next)
                                        .onSubmit { focusedField = .confirmPassword }
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

                        // Konfirmasi Password
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Konfirmasi Kata Sandi *")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)

                            HStack {
                                Image(systemName: "lock.shield.fill")
                                    .foregroundStyle(.secondary)
                                    .frame(width: 20)

                                if isPasswordVisible {
                                    TextField("Ulangi kata sandi", text: $confirmPassword)
                                        .focused($focusedField, equals: .confirmPassword)
                                        .submitLabel(.go)
                                        .onSubmit { handleRegister() }
                                } else {
                                    SecureField("Ulangi kata sandi", text: $confirmPassword)
                                        .focused($focusedField, equals: .confirmPassword)
                                        .submitLabel(.go)
                                        .onSubmit { handleRegister() }
                                }
                            }
                            .padding(14)
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    // Tombol Daftar
                    Button {
                        handleRegister()
                    } label: {
                        HStack(spacing: 8) {
                            if authViewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Daftar Sekarang")
                                    .font(.headline.weight(.semibold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(isFormFilled && !authViewModel.isLoading ? Color.blue : Color.blue.opacity(0.4))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .disabled(!isFormFilled || authViewModel.isLoading)
                    .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 30)
            }
            .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
            .navigationTitle("Pendaftaran")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Tutup") {
                        authViewModel.clearMessages()
                        dismiss()
                    }
                }
            }
            .alert("Pendaftaran Berhasil", isPresented: $isRegistrationSuccess) {
                Button("Kembali ke Login") {
                    dismiss()
                }
            } message: {
                Text(authViewModel.successMessage ?? "Akun berhasil dibuat. Silakan masuk menggunakan username dan kata sandi Anda.")
            }
        }
    }

    @ViewBuilder
    private func inputField(
        title: String,
        placeholder: String,
        text: Binding<String>,
        icon: String,
        field: Field,
        nextField: Field?,
        keyboardType: UIKeyboardType,
        autocapitalization: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)

            HStack {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                TextField(placeholder, text: text)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(autocapitalization ? .words : .never)
                    .keyboardType(keyboardType)
                    .focused($focusedField, equals: field)
                    .submitLabel(nextField != nil ? .next : .done)
                    .onSubmit {
                        if let next = nextField {
                            focusedField = next
                        }
                    }
            }
            .padding(14)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func handleRegister() {
        localValidationMessage = nil
        authViewModel.clearMessages()

        let trimmedUsername = username.trimmingCharacters(in: .whitespaces)
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)

        guard !trimmedUsername.isEmpty else {
            localValidationMessage = "Username wajib diisi."
            return
        }

        guard !trimmedEmail.isEmpty, trimmedEmail.contains("@"), trimmedEmail.contains(".") else {
            localValidationMessage = "Format email tidak valid."
            return
        }

        guard password.count >= 6 else {
            localValidationMessage = "Kata sandi minimal 6 karakter."
            return
        }

        guard password == confirmPassword else {
            localValidationMessage = "Konfirmasi kata sandi tidak cocok."
            return
        }

        focusedField = nil

        Task {
            let success = await authViewModel.register(
                username: trimmedUsername,
                email: trimmedEmail,
                password: password,
                fullName: fullName.isEmpty ? nil : fullName.trimmingCharacters(in: .whitespaces),
                phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber.trimmingCharacters(in: .whitespaces)
            )

            if success {
                isRegistrationSuccess = true
            }
        }
    }
}

