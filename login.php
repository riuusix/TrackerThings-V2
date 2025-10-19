<?php
session_start();
require_once 'koneksi.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'];
    $password = $_POST['password'];

    $stmt = $conn->prepare("SELECT id, password FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();
        if (password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $username;
            header("Location: index.php");
            exit();
        } else {
            $error = 'Username atau password salah.';
        }
    } else {
        $error = 'Username atau password salah.';
    }
    $stmt->close();
}
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Student Dashboard</title>
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

        /* --- Latar Belakang & Gaya Kaca --- */
        body {
            background-color: #f0f4f9;
            background-image: radial-gradient(at 0% 0%, hsla(214, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(280, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(190, 80%, 95%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(340, 80%, 95%, 1) 0px, transparent 50%);
            transition: background-image 0.5s ease-in-out;
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
            transition: background 0.3s, border 0.3s;
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
    </style>
</head>

<body class="flex items-center justify-center min-h-screen p-4 antialiased transition-colors duration-300">
    <div class="w-full max-w-md">
        <form method="POST" action="login.php" class="glass-card p-8 rounded-2xl shadow-lg space-y-6">
            <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-white drop-shadow-md">Selamat Datang</h1>

            <?php if ($error): ?>
                <div class="bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
                    <span class="block sm:inline"><?php echo $error; ?></span>
                </div>
            <?php endif; ?>

            <div>
                <label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                <input type="text" name="username" id="username" required
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <input type="password" name="password" id="password" required
                    class="glass-input mt-1 block w-full rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <button type="submit"
                class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30 transition-all active:scale-[0.98]">
                Login
            </button>

            <p class="text-center text-sm text-gray-600 dark:text-gray-400">
                Belum punya akun? <a href="register.php" class="font-medium text-blue-600 hover:underline dark:text-blue-400">Daftar di sini</a>
            </p>
        </form>
    </div>
</body>

</html>