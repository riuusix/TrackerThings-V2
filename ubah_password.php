<?php
// --- Keamanan: Memulai session dan validasi akses ---
require_once 'koneksi.php'; // Hubungkan ke DB
// session_start();


if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

// --- AMBIL DATA AKTIVITAS ---
$user_id = $_SESSION['user_id'];

$stmt = $conn->prepare("SELECT email, created_at, profile_updated_at, password_changed_at, security_prompt FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$user_activity = $stmt->get_result()->fetch_assoc();
$conn->close(); // Tutup koneksi setelah selesai

// Fungsi helper kecil untuk format tanggal
function format_activity_date($date_string)
{
    if (is_null($date_string)) {
        // Ini adalah status khusus, jadi kita beri style sendiri
        return '<span class="text-slate-500 dark:text-gray-500">Belum pernah</span>';
    }

    if (strtotime($date_string) > (time() - 300)) {
        // Ini juga status khusus, kita beri style sendiri
        return '<span class="text-green-600 dark:text-green-400 font-semibold">Baru saja</span>';
    }

    // ▼▼▼ INI PERBAIKANNYA ▼▼▼
    // Jika ini hanya tanggal biasa, kembalikan TANGGAL-nya saja (string polos).
    // Jangan dibungkus <span>. Biarkan tag <p> di HTML yang memberi style.
    return date('d F Y, H:i', strtotime($date_string));
} ?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Akun Pengguna</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <style>
        @import url('https://rsms.me/inter/inter.css');

        html {
            font-family: 'Inter', sans-serif;
        }

        [x-cloak] {
            display: none !important;
        }

        /* --- Style Liquid Glass (Sama seperti profile.php) --- */
        body {
            background-color: #f1f5f9;
            background-image: radial-gradient(at 0% 0%, hsla(214, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(280, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(190, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(340, 80%, 95%, 0.5) 0px, transparent 50%);
        }

        .dark body {
            background-color: #0d1117;
            background-image: radial-gradient(at 0% 0%, hsla(220, 40%, 12%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(260, 40%, 12%, 1) 0px, transparent 50%);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.65);
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(203, 213, 225, 0.7);
            /* Border abu-abu */
            box-shadow: 0 8px 32px 0 rgba(100, 116, 139, 0.15);
            color: #1e293b !important;
            /* <-- TAMBAHKAN BARIS INI */
        }

        .dark .glass-card {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
            color: #e2e8f0;
            /* <-- TAMBAHKAN BARIS INI */
        }

        .glass-input {
            background: rgba(241, 245, 249, 0.7) !important;
            border: 1px solid rgba(203, 213, 225, 0.7) !important;
            color: #1e293b;
            padding-left: 2.75rem;
            /* Beri ruang untuk ikon di kiri */
        }

        /* ... (style .dark .glass-input) ... */

        /* ▼▼▼ TAMBAHKAN CLASS BARU INI ▼▼▼ */
        .glass-text {
            color: #1e293b !important;
            /* Warna default (light mode) -> slate-800 */
        }

        .dark .glass-text {
            color: #e2e8f0 !important;
            /* Warna dark mode -> slate-200 */
        }

        .dark .glass-input {
            background: rgba(55, 65, 81, 0.5) !important;
            border: 1px solid rgba(75, 85, 99, 0.5) !important;
            color: #f1f5f9 !important;
        }

        /* ... (style .dark .glass-input) ... */

        .glass-button {
            background: rgba(255, 255, 255, 0.3);
            -webkit-backdrop-filter: blur(5px);
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.4);
            transition: background 0.3s, border 0.3s;
        }

        .dark .glass-button {
            background: rgba(31, 41, 55, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }
    </style>
</head>

<body class="flex items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 antialiased">
    <div class="w-full max-w-2xl mx-auto">

        <nav class="absolute top-6 left-6 z-10">
            <a href="index.php"
                class="glass-button w-12 h-12 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 group"
                title="Kembali ke Dashboard">
                <svg class="w-6 h-6 text-gray-700 dark:text-gray-200 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
            </a>
        </nav>
        <div class="absolute top-6 right-6 z-10 flex items-center h-12">
            <span class="glass-text font-bold text-lg tracking-tight">
                TrackerThings
            </span>
        </div>


        <div class="w-full max-w-2xl mx-auto mb-4">
            <?php if (isset($_SESSION['success'])): ?>
                <div x-data="{ show: true }" x-init="setTimeout(() => show = false, 4000)" x-show="show" x-transition class="bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <span><?php echo $_SESSION['success'];
                            unset($_SESSION['success']); ?></span>
                </div>
            <?php endif; ?>
            <?php if (isset($_SESSION['error'])): ?>
                <div x-data="{ show: true }" x-init="setTimeout(() => show = false, 4000)" x-show="show" x-transition class="bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm" role="alert">
                    <span><?php echo $_SESSION['error'];
                            unset($_SESSION['error']); ?></span>
                </div>
            <?php endif; ?>
        </div>

        <div class="glass-card rounded-2xl shadow-lg w-full"
            x-data="{ activeTab: 'password' }">

            <div class="flex border-b border-black/10 dark:border-white/10 px-4 pt-2">
                <button @click="activeTab = 'password'"
                    x-transition:enter="transition ease-out duration-300"
                    x-transition:enter-start="opacity-50"
                    x-transition:enter-end="opacity-100"
                    x-transition:leave="transition ease-in duration-150"
                    x-transition:leave-start="opacity-100"
                    x-transition:leave-end="opacity-0"
                    :class="{ 'border-blue-500 text-blue-600 dark:text-blue-400': activeTab === 'password', 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600': activeTab !== 'password' }"
                    class="px-1 py-4 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-150 mr-8">
                    Ubah Password
                </button>
                <button @click="activeTab = 'security'"
                    x-transition:enter="transition ease-out duration-300"
                    x-transition:enter-start="opacity-50"
                    x-transition:enter-end="opacity-100"
                    x-transition:leave="transition ease-in duration-150"
                    x-transition:leave-start="opacity-100"
                    x-transition:leave-end="opacity-0"
                    :class="{ 'border-blue-500 text-blue-600 dark:text-blue-400': activeTab === 'security', 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600': activeTab !== 'security' }"
                    class="px-1 py-4 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-150 mr-8">
                    Keamanan Akun
                </button>
                <button @click="activeTab = 'activity'"
                    x-transition:enter="transition ease-out duration-300"
                    x-transition:enter-start="opacity-50"
                    x-transition:enter-end="opacity-100"
                    x-transition:leave="transition ease-in duration-150"
                    x-transition:leave-start="opacity-100"
                    x-transition:leave-end="opacity-0"
                    :class="{ 'border-blue-500 text-blue-600 dark:text-blue-400': activeTab === 'activity', 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600': activeTab !== 'activity' }"
                    class="px-1 py-4 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-150">
                    Aktivitas Akun
                </button>
            </div>

            <div>
                <div x-show="activeTab === 'password'" x-transition class="p-8 sm:p-10"
                    x-data="{ showCurrent: false, showNew: false, showConfirm: false }">
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-10 h-10 rounded-lg bg-blue-500/20 dark:bg-blue-800/30 flex items-center justify-center">
                            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                        </div>
                        <h2 class="glass-text text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Ubah Password</h2>
                    </div>
                    <p class="glass-text text-sm text-slate-600 dark:text-gray-400 mb-6">
                        Password Anda harus minimal 8 karakter, mengandung huruf besar, huruf kecil, angka, dan satu karakter spesial.
                    </p>
                    <form action="proses_ganti_password.php" method="POST" class="space-y-5">
                        <div>
                            <label class="glass-text block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Current Password</label>
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 flex items-center pl-3.5"><svg class="w-5 h-5 text-slate-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg></span>
                                <input :type="showCurrent ? 'text' : 'password'" name="current_password" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                                <button type="button" @click="showCurrent = !showCurrent" class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"><svg x-show="!showCurrent" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                    </svg><svg x-show="showCurrent" x-cloak class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064 7 9.542 7 1.865 0 3.632.636 5.006 1.675m-1.006 8.35A3 3 0 0112 15a3 3 0 01-3-3m.006-5.35A10.003 10.003 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.675 3.006m-8.35-1.006A3 3 0 0012 9a3 3 0 00-3 3m1.875 4.825L18 18.006M6 6.006L18 18.006"></path>
                                    </svg></button>
                            </div>
                        </div>
                        <div>
                            <label class="glass-text block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">New Password</label>
                            <div class="relative"><span class="absolute inset-y-0 left-0 flex items-center pl-3.5"><svg class="w-5 h-5 text-slate-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg></span><input :type="showNew ? 'text' : 'password'" name="new_password" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"><button type="button" @click="showNew = !showNew" class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"><svg x-show="!showNew" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                    </svg><svg x-show="showNew" x-cloak class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064 7 9.542 7 1.865 0 3.632.636 5.006 1.675m-1.006 8.35A3 3 0 0112 15a3 3 0 01-3-3m.006-5.35A10.003 10.003 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.675 3.006m-8.35-1.006A3 3 0 0012 9a3 3 0 00-3 3m1.875 4.825L18 18.006M6 6.006L18 18.006"></path>
                                    </svg></button></div>
                        </div>
                        <div>
                            <label class="glass-text block text-sm font-medium text-slate-600 dark:text-gray-300 mb-1">Confirm Password</label>
                            <div class="relative"><span class="absolute inset-y-0 left-0 flex items-center pl-3.5"><svg class="w-5 h-5 text-slate-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg></span><input :type="showConfirm ? 'text' : 'password'" name="confirm_password" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"><button type="button" @click="showConfirm = !showConfirm" class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300"><svg x-show="!showConfirm" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                    </svg><svg x-show="showConfirm" x-cloak class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064 7 9.542 7 1.865 0 3.632.636 5.006 1.675m-1.006 8.35A3 3 0 0112 15a3 3 0 01-3-3m.006-5.35A10.003 10.003 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.675 3.006m-8.35-1.006A3 3 0 0012 9a3 3 0 00-3 3m1.875 4.825L18 18.006M6 6.006L18 18.006"></path>
                                    </svg></button></div>
                        </div>
                        <div class="flex items-center gap-4 pt-4 border-t border-black/10 dark:border-white/10"><button type="submit" class="w-full text-center bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30">Ubah Password</button></div>
                    </form>
                </div>

                <div x-show="activeTab === 'security'" x-transition class="p-8 sm:p-10" x-cloak>
                    <form action="proses_simpan_keamanan.php" method="POST" class="space-y-5">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-green-500/20 dark:bg-green-800/30 flex items-center justify-center"><svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H5v-2H3v-2H1l-1-4a6 6 0 016-6h4a6 6 0 016 6zM15 7V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2"></path>
                                </svg></div>
                            <h2 class="glass-text text-2xl font-bold dark:text-white tracking-tight">Frasa Kunci Rahasia</h2>
                        </div>
                        <p class="glass-text text-sm dark:text-gray-400">Ini akan digunakan untuk verifikasi jika Anda lupa password.</p>
                        <div>
                            <label for="security_prompt" class="glass-text block text-sm font-medium dark:text-gray-300 mb-1">Petunjuk (Contoh: Makanan favorit?)</label>
                            <input type="text" name="security_prompt" id="security_prompt" value="<?php echo htmlspecialchars($user_activity['security_prompt'] ?? ''); ?>" placeholder="Contoh: Nama kucing pertama?" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        </div>
                        <div>
                            <label for="security_answer" class="glass-text block text-sm font-medium dark:text-gray-300 mb-1">Jawaban Rahasia (Min. 3 kata)</label>
                            <input type="password" name="security_answer" id="security_answer" placeholder="Kosongkan jika tidak ingin mengubah" class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        </div>
                        <div>
                            <label for="confirm_password_security" class="glass-text block text-sm font-medium dark:text-gray-300 mb-1">Konfirmasi Password Anda Saat Ini</label>
                            <input type="password" name="current_password" id="confirm_password_security" placeholder="Wajib diisi untuk menyimpan" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                            <p class="text-xs text-slate-500 dark:text-gray-500 mt-1">Untuk alasan keamanan, masukkan password Anda saat ini untuk menyimpan perubahan.</p>
                        </div>
                        <button type="submit" class="w-full text-center bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-500/30 dark:shadow-green-800/30">Simpan Frasa Rahasia</button>
                    </form>
                </div>

                <div x-show="activeTab === 'activity'" x-transition class="p-8 sm:p-10" x-cloak>
                    <div class="flex items-center gap-3 mb-6">
                        <div class="w-10 h-10 rounded-lg bg-blue-500/20 dark:bg-blue-800/30 flex items-center justify-center"><svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg></div>
                        <h2 class="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Aktivitas Akun</h2>
                    </div>
                    <p class="glass-text text-sm text-slate-600 dark:text-gray-400 mb-6">Berikut adalah riwayat aktivitas keamanan di akun Anda.</p>
                    <ul class="space-y-5 mt-8">
                        <li class="flex items-start gap-3"><svg class="w-5 h-5 text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <div>
                                <p class="glass-text font-semibold text-slate-700 dark:text-gray-200">Akun Dibuat</p>
                                <p class="dark glass-text text-sm"><?php echo format_activity_date($user_activity['created_at']); ?></p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3"><svg class="w-5 h-5 text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                            <div>
                                <p class="glass-text font-semibold text-slate-700 dark:text-gray-200">Profil Terakhir Diupdate</p>
                                <p class="dark glass-text text-sm"><?php echo format_activity_date($user_activity['profile_updated_at']); ?></p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3"><svg class="w-5 h-5 text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                            <div>
                                <p class="glass-text font-semibold text-slate-700 dark:text-gray-200">Password Terakhir Diubah</p>
                                <p class="dark glass-text text-sm"><?php echo format_activity_date($user_activity['password_changed_at']); ?></p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3 pt-5 border-t border-black/10 dark:border-white/10"><svg class="w-5 h-5 text-slate-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                            <div>
                                <p class="glass-text font-semibold text-slate-700 dark:text-gray-200">Email Akun</p>
                                <p class="text-sm text-slate-500 dark:text-gray-400"><?php echo htmlspecialchars($user_activity['email']); ?></p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>

</html>