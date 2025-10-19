<?php
// --- Menampilkan semua error PHP untuk debugging ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'koneksi.php';
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil semua data dari form
    $username = $_POST['username'];
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $phone_number = $_POST['phone_number'];
    $password = $_POST['password'];

    // Validasi dasar
    if (empty($username) || empty($email) || empty($password)) {
        $error = 'Username, Email, dan Password tidak boleh kosong.';
    } else {
        // Cek apakah username sudah ada
        $stmt_check_user = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt_check_user->bind_param("s", $username);
        $stmt_check_user->execute();
        $result_check_user = $stmt_check_user->get_result();

        // Cek apakah email sudah ada
        $stmt_check_email = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $stmt_check_email->bind_param("s", $email);
        $stmt_check_email->execute();
        $result_check_email = $stmt_check_email->get_result();

        if ($result_check_user->num_rows > 0) {
            $error = 'Username sudah digunakan, coba yang lain.';
        } elseif ($result_check_email->num_rows > 0) {
            $error = 'Email sudah terdaftar, coba gunakan email lain.';
        } else {
            // Jika semua aman, lanjutkan proses registrasi
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $stmt_insert = $conn->prepare("INSERT INTO users (username, full_name, email, phone_number, password) VALUES (?, ?, ?, ?, ?)");
            $stmt_insert->bind_param("sssss", $username, $full_name, $email, $phone_number, $hashed_password);

            if ($stmt_insert->execute()) {
                $success = 'Akun berhasil dibuat! Silakan login.';
            } else {
                $error = 'Terjadi kesalahan saat membuat akun, coba lagi.';
            }
            $stmt_insert->close();
        }
        $stmt_check_user->close();
        $stmt_check_email->close();
    }
}
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrasi - Student Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class'
        }
    </script>
    <style>
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
    </style>
</head>

<body class="flex items-center justify-center min-h-screen p-4 antialiased transition-colors duration-300">
    <div class="w-full max-w-md">
        <form method="POST" action="register.php" class="glass-card p-8 rounded-2xl shadow-lg space-y-4">
            <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-white drop-shadow-md">Buat Akun Baru</h1>

            <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <span><?php echo $error; ?></span>
                </div>
            <?php endif; ?>
            <?php if ($success): ?>
                <div class="bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <span><?php echo $success; ?></span>
                </div>
            <?php endif; ?>

            <div>
                <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username <span class="text-red-500">*</span></label>
                <input type="text" name="username" id="username" required
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label for="full_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                <input type="text" name="full_name" id="full_name"
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email <span class="text-red-500">*</span></label>
                <input type="email" name="email" id="email" required
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label for="phone_number" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Nomor Telepon</label>
                <input type="tel" name="phone_number" id="phone_number"
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password <span class="text-red-500">*</span></label>
                <input type="password" name="password" id="password" required
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <button type="submit"
                class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30 transition-all active:scale-[0.98] !mt-6">
                Daftar
            </button>

            <p class="text-center text-sm text-gray-600 dark:text-gray-400 !mt-4">
                Sudah punya akun? <a href="login.php" class="font-medium text-blue-600 hover:underline dark:text-blue-400">Login di sini</a>
            </p>
        </form>
    </div>
</body>

</html>