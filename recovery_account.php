<?php
// --- 1. Validasi Awal ---
require_once 'koneksi.php';
// session_start();

// Ambil username dari modal login
$username = $_POST['username_forgot'] ?? '';

if (empty($username)) {
    // Jika dibuka tanpa username, tendang balik
    $_SESSION['error'] = "Username tidak boleh kosong.";
    header('Location: login.php');
    exit();
}

// Cek user dan frasa keamanannya
$stmt = $conn->prepare("SELECT id, security_prompt FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

// Cek jika user tidak ada ATAU belum setup frasa rahasia
if (!$user || empty($user['security_prompt'])) {
    $_SESSION['error'] = "Akun tidak ditemukan atau belum mengatur Frasa Kunci Rahasia.";
    header('Location: login.php');
    exit();
}

// --- 2. Simpan Data Aman ke Sesi ---
// Kita simpan ID dan Petunjuk ke Sesi agar aman
$_SESSION['recovery_user_id'] = $user['id'];
$security_prompt = $user['security_prompt']; // Ini akan kita teruskan ke AlpineJS

$conn->close();
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pulihkan Akun Anda</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
    <style>
        /* ▼▼▼ Copy-paste SEMUA style .glass-card, .glass-input, body, dll dari login.php ke sini ▼▼▼ */
        @import url('https://rsms.me/inter/inter.css');

        html {
            font-family: 'Inter', sans-serif;
        }

        [x-cloak] {
            display: none !important;
        }

        body {
            background-color: #f0f4f9;
            background-image: radial-gradient(at 0% 0%, hsla(214, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(280, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(190, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(340, 80%, 95%, 1) 0px, transparent 50%);
        }

        .dark body {
            background-color: #0d1117;
            background-image: radial-gradient(at 0% 0%, hsla(220, 40%, 12%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(260, 40%, 12%, 1) 0px, transparent 50%);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.45);
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
        }

        .dark .glass-card {
            background: rgba(30, 41, 59, 0.4);
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
        }

        .glass-input {
            background: rgba(223, 223, 223, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            color: #1f2937 !important;
        }

        .dark .glass-input {
            background: rgba(17, 24, 39, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #f3f4f6 !important;
        }

        /* Style untuk Loading Spinner */
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-left-color: #ffffff;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
    </style>

    <script>
        function recoveryForm() {
            return {
                // Tiga 'Wujud' (State) Halaman
                currentState: 'ask_answer', // 'ask_answer', 'ask_password', 'success'
                isLoading: false,
                errorMessage: '',

                // Data Form
                securityAnswer: '',
                newPassword: '',
                confirmPassword: '',

                // Fungsi untuk 'Wujud 1'
                verifyAnswer() {
                    this.isLoading = true;
                    this.errorMessage = '';

                    let formData = new FormData();
                    formData.append('action', 'verify_answer');
                    formData.append('security_answer', this.securityAnswer);

                    fetch('proses_recover.php', {
                            method: 'POST',
                            body: formData
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                // SUKSES! Pindah ke 'Wujud' berikutnya (slideshow)
                                this.currentState = 'ask_password';
                            } else {
                                this.errorMessage = data.message;
                            }
                        })
                        .catch(() => this.errorMessage = 'Terjadi kesalahan jaringan.')
                        .finally(() => this.isLoading = false);
                },

                // Fungsi untuk 'Wujud 2'
                resetPassword() {
                    if (this.newPassword !== this.confirmPassword) {
                        this.errorMessage = 'Password baru dan konfirmasi tidak cocok.';
                        return;
                    }
                    // Validasi kekuatan password (opsional tapi disarankan)
                    if (this.newPassword.length < 8) {
                        this.errorMessage = 'Password baru minimal 8 karakter.';
                        return;
                    }

                    this.isLoading = true;
                    this.errorMessage = '';

                    let formData = new FormData();
                    formData.append('action', 'reset_password');
                    formData.append('new_password', this.newPassword);
                    formData.append('confirm_password', this.confirmPassword);

                    fetch('proses_recover.php', {
                            method: 'POST',
                            body: formData
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                // SUKSES! Pindah ke 'Wujud' 3 (slideshow)
                                this.currentState = 'success';
                            } else {
                                this.errorMessage = data.message;
                            }
                        })
                        .catch(() => this.errorMessage = 'Terjadi kesalahan jaringan.')
                        .finally(() => this.isLoading = false);
                }
            }
        }
    </script>
</head>

<body class="flex items-center justify-center min-h-screen p-4 antialiased">

    <div x-data="recoveryForm()" class="w-full max-w-md">
        <div class="glass-card rounded-2xl shadow-lg relative overflow-hidden">

            <div x-show="errorMessage" x-transition class="absolute top-0 left-0 right-0 p-4 bg-red-500/80 text-white text-center text-sm z-20">
                <span x-text="errorMessage"></span>
                <button @click="errorMessage = ''" class="absolute top-1 right-2 p-2">&times;</button>
            </div>

            <form @submit.prevent="verifyAnswer"
                x-show="currentState === 'ask_answer'"
                x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="opacity-0 transform translate-x-full"
                x-transition:enter-end="opacity-100 transform translate-x-0"
                x-transition:leave="transition ease-in duration-300"
                x-transition:leave-start="opacity-100 transform translate-x-0"
                x-transition:leave-end="opacity-0 transform -translate-x-full"
                class="p-8 space-y-6">

                <h2 class="text-2xl font-bold text-center text-gray-800 dark:text-white">Verifikasi Akun</h2>
                <p class="text-center text-sm text-gray-600 dark:text-gray-400">Untuk melanjutkan, jawab petunjuk keamanan Anda:</p>

                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Petunjuk Anda:</label>
                    <p class="text-lg font-semibold text-gray-800 dark:text-white mt-1">"<?php echo htmlspecialchars($security_prompt); ?>"</p>
                </div>

                <div>
                    <label for="security_answer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Jawaban Rahasia</label>
                    <input type="password" x-model="securityAnswer" id="security_answer" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                </div>

                <button type="submit" :disabled="isLoading" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center transition" :class="{ 'opacity-50 cursor-not-allowed': isLoading }">
                    <div x-show="isLoading" class="spinner mr-2"></div>
                    <span x-text="isLoading ? 'Memverifikasi...' : 'Verifikasi'"></span>
                </button>
                <p class="text-center text-sm"><a href="login.php" class="text-blue-600 hover:underline dark:text-blue-400">Kembali ke Login</a></p>
            </form>

            <form @submit.prevent="resetPassword"
                x-show="currentState === 'ask_password'"
                x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="opacity-0 transform translate-x-full"
                x-transition:enter-end="opacity-100 transform translate-x-0"
                x-transition:leave="transition ease-in duration-300"
                x-transition:leave-start="opacity-100 transform translate-x-0"
                x-transition:leave-end="opacity-0 transform -translate-x-full"
                class="p-8 space-y-6" x-cloak>

                <h2 class="text-2xl font-bold text-center text-gray-800 dark:text-white">Atur Password Baru</h2>
                <p class="text-center text-sm text-gray-600 dark:text-gray-400">Verifikasi berhasil! Silakan atur password baru Anda.</p>

                <div>
                    <label for="new_password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password Baru</label>
                    <input type="password" x-model="newPassword" id="new_password" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                </div>
                <div>
                    <label for="confirm_password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Konfirmasi Password Baru</label>
                    <input type="password" x-model="confirmPassword" id="confirm_password" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                </div>

                <button type="submit" :disabled="isLoading" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center transition" :class="{ 'opacity-50 cursor-not-allowed': isLoading }">
                    <div x-show="isLoading" class="spinner mr-2"></div>
                    <span x-text="isLoading ? 'Menyimpan...' : 'Simpan Password Baru'"></span>
                </button>
            </form>

            <div x-show="currentState === 'success'"
                x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="opacity-0 transform translate-x-full"
                x-transition:enter-end="opacity-100 transform translate-x-0"
                class="p-8 space-y-6 text-center" x-cloak>

                <h2 class="text-2xl font-bold text-center text-green-600 dark:text-green-400">Berhasil!</h2>
                <p class="text-gray-800 dark:text-white">Password Anda telah berhasil diubah.</p>
                <a href="login.php" class="inline-block w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition">
                    Kembali ke Login
                </a>
            </div>

        </div>
    </div>


</body>

</html>