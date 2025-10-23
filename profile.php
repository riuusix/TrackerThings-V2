<?php
// --- Keamanan: Memulai session dan validasi akses ---

require_once 'koneksi.php';
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

$user_id = $_SESSION['user_id'];

// Ambil data lengkap pengguna
$stmt_user = $conn->prepare("SELECT username, full_name, email, phone_number, profile_picture_url, created_at FROM users WHERE id = ?");
$stmt_user->bind_param("i", $user_id);
$stmt_user->execute();
$result_user = $stmt_user->get_result();
$user = $result_user->fetch_assoc();

if (!$user) {
    die("Error: Data pengguna tidak ditemukan.");
}

// Ambil data statistik
$stmt_courses = $conn->prepare("SELECT COUNT(id) as total_courses FROM jadwal WHERE user_id = ?");
$stmt_courses->bind_param("i", $user_id);
$stmt_courses->execute();
$total_courses = $stmt_courses->get_result()->fetch_assoc()['total_courses'] ?? 0;

$stmt_tasks = $conn->prepare("SELECT COUNT(id) as total_tasks FROM tugas WHERE user_id = ?");
$stmt_tasks->bind_param("i", $user_id);
$stmt_tasks->execute();
$total_tasks = $stmt_tasks->get_result()->fetch_assoc()['total_tasks'] ?? 0;

$stmt_completed = $conn->prepare("SELECT COUNT(id) as completed_tasks FROM tugas WHERE user_id = ? AND status = 'Selesai'");
$stmt_completed->bind_param("i", $user_id);
$stmt_completed->execute();
$completed_tasks = $stmt_completed->get_result()->fetch_assoc()['completed_tasks'] ?? 0;

$stmt_user->close();
$stmt_courses->close();
$stmt_tasks->close();
$stmt_completed->close();
$conn->close();
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profil Pengguna</title>
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

        body {
            background-color: #f1f5f9;
            /* Latar belakang sedikit lebih gelap (slate-100) */
            background-image: radial-gradient(at 0% 0%, hsla(214, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(280, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(190, 80%, 95%, 0.5) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(340, 80%, 95%, 0.5) 0px, transparent 50%);
        }

        .dark body {
            background-color: #0d1117;
            background-image: radial-gradient(at 0% 0%, hsla(220, 40%, 12%, 1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(260, 40%, 12%, 1) 0px, transparent 50%);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.65);
            /* Lebih pekat (frosted) */
            -webkit-backdrop-filter: blur(16px);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 8px 32px 0 rgba(100, 116, 139, 0.15);
        }

        .dark .glass-card {
            background: rgba(30, 41, 59, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
        }

        .glass-input {
            background: rgba(241, 245, 249, 0.7) !important;
            /* Abu-abu terang (slate-100) */
            border: 1px solid rgba(203, 213, 225, 0.7) !important;
            /* Border abu-abu (slate-300) */
            color: #1e293b !important;
            /* Warna teks hitam (slate-800) */
        }

        .dark .glass-input {
            background: rgba(55, 65, 81, 0.5) !important;
            border: 1px solid rgba(75, 85, 99, 0.5) !important;
            color: #f1f5f9 !important;
            /* Warna teks putih (slate-100) */
        }

        .custom-scrollbar::-webkit-scrollbar {
            display: none;
        }

        .custom-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        /* Anda harus melakukan ini untuk SEMUA elemen */
        .glass-card h1,
        .glass-card h2,
        .glass-card label {
            color: #1e293b;
            /* ini text-slate-800 */
        }

        .glass-card p {
            color: #64748b;
            /* ini text-slate-500 */
        }

        .glass-card .statistik p:first-child {
            color: #1e293b;
        }

        /* ...dan seterusnya */

        /* Lalu Anda harus menimpanya lagi untuk dark mode */
        .dark .glass-card h1,
        .dark .glass-card h2,
        .dark .glass-card label {
            color: #ffffff;
        }

        .dark .glass-card p {
            color: #94a3b8;
        }

        /* ...dan seterusnya */
    </style>
</head>

<body class="flex items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 antialiased">

    <div class="w-full transition-all duration-700 ease-in-out" x-data="{ isEditing: false }" :class="isEditing ? 'max-w-4xl' : 'max-w-lg'">
        <div class="grid gap-8 transition-all duration-500" :class="isEditing ? 'lg:grid-cols-2' : 'lg:grid-cols-1'">

            <!-- Konten Profil -->
            <div class="transition-all duration-500 ease-in-out">
                <div class="glass-card p-8 rounded-2xl shadow-lg h-full flex flex-col">
                    <div class="flex flex-col items-center text-center">
                        <div class="w-24 h-24 rounded-full border-2 border-white/50 dark:border-white/10 mb-4 overflow-hidden bg-blue-500/20 dark:bg-blue-800/30">
                            <?php if (!empty($user['profile_picture_url'])): ?>
                                <img src="<?php echo htmlspecialchars($user['profile_picture_url']); ?>" alt="Foto Profil" class="w-full h-full object-cover">
                            <?php else: ?>
                                <svg class="w-full h-full p-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                            <?php endif; ?>
                        </div>
                        <h1 class="text-3xl font-bold text-slate-800 dark:text-white drop-shadow-md white:text-dark drop-shadow-black"><?php echo htmlspecialchars($user['full_name'] ?: $user['username']); ?></h1>
                        <p class="text-sm text-slate-500 dark:text-gray-400">@<?php echo htmlspecialchars($user['username']); ?></p>
                    </div>
                    <!-- Statistik tugas -->
                    <div class="mt-8 grid grid-cols-3 gap-4 text-center border-t border-b border-black/10 dark:border-white/10 py-4">
                        <div>
                            <p class="text-2xl font-bold text-slate-800 dark:text-white"><?php echo $total_courses; ?></p>
                            <p class="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider">Mata Kuliah</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800 dark:text-white"><?php echo $total_tasks; ?></p>
                            <p class="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider">Total Tugas</p>
                        </div>
                        <div>
                            <p class="text-2xl font-bold text-slate-800 dark:text-white"><?php echo $completed_tasks; ?></p>
                            <p class="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider">Tugas Selesai</p>
                        </div>
                    </div>
                    <div class="mt-6 space-y-4">
                        <div class="flex items-center"><svg class="w-5 h-5 text-slate-400 dark:text-gray-400 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg><span class="text-slate-700 dark:text-gray-300"><?php echo htmlspecialchars($user['email']); ?></span></div>
                        <div class="flex items-center"><svg class="w-5 h-5 text-slate-400 dark:text-gray-400 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                            </svg><span class="text-slate-700 dark:text-gray-300"><?php echo htmlspecialchars($user['phone_number'] ?: 'Nomor telepon belum diatur'); ?></span></div>
                        <div class="flex items-center"><svg class="w-5 h-5 text-slate-400 dark:text-gray-400 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg><span class="text-slate-700 dark:text-gray-300">Bergabung pada <?php echo date('d F Y', strtotime($user['created_at'])); ?></span></div>
                    </div>
                    <div class="mt-auto flex items-center gap-4 border-t border-black/10 dark:border-white/10 pt-6 mt-8">
                        <a href="index.php" class="w-full text-center bg-slate-200 dark:bg-gray-700/50 text-slate-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600/50 transition-all">Kembali</a>
                        <button @click="isEditing = true" class="w-full text-center bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30">Edit Profil</button>
                    </div>
                </div>
            </div>

            <!-- Form Edit Profil -->
            <div x-show="isEditing" x-transition:enter="transition ease-out duration-500 delay-200" x-transition:enter-start="opacity-0 transform translate-x-8" x-transition:enter-end="opacity-100 transform translate-x-0" x-transition:leave="transition ease-in duration-300" x-transition:leave-start="opacity-100 transform translate-x-0" x-transition:leave-end="opacity-0 transform translate-x-8" class="hidden lg:block" x-cloak>
                <div class="glass-card rounded-2xl shadow-lg h-full flex flex-col">
                    <div class="custom-scrollbar overflow-y-auto p-8">
                        <h2 class="text-2xl font-bold text-slate-800 dark:text-white mb-6 white:text-dark drop-shadow-black">Edit Profil Anda</h2>
                        <form action="proses_edit_profile.php" method="POST" class="space-y-4" enctype="multipart/form-data">
                            <input type="hidden" name="old_profile_picture" value="<?php echo htmlspecialchars($user['profile_picture_url'] ?? 'belum ada '); ?>">
                            <div>
                                <label for="profile_picture" class="block text-sm font-medium text-slate-600 dark:text-gray-300">Foto Profil</label>
                                <input type="file" name="profile_picture" id="profile_picture"
                                    class="mt-1 block w-full text-sm text-slate-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  dark:file:bg-blue-800/30 dark:file:text-blue-300
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-700/50">
                                <p class="text-xs text-slate-500 dark:text-gray-500 mt-1">Hanya .jpg, .png, atau .jpeg. Maks 2MB.</p>
                            </div>
                            <div><label for="full_name" class="block text-sm font-medium text-slate-600 dark:text-gray-300">Nama Lengkap</label><input type="text" name="full_name" id="full_name" value="<?php echo htmlspecialchars($user['full_name']); ?>" class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"></div>
                            <div><label for="email" class="block text-sm font-medium text-slate-600 dark:text-gray-300">Email</label><input type="email" name="email" id="email" value="<?php echo htmlspecialchars($user['email']); ?>" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"></div>
                            <div><label for="phone_number" class="block text-sm font-medium text-slate-600 dark:text-gray-300">Nomor Telepon</label><input type="tel" name="phone_number" id="phone_number" value="<?php echo htmlspecialchars($user['phone_number']); ?>" class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"></div>
                            <div class="mt-8 flex items-center gap-4 border-t border-black/10 dark:border-white/10 pt-6">
                                <button type="button" @click="isEditing = false" class="w-full text-center bg-slate-200 dark:bg-gray-700/50 text-slate-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600/50 transition-all">Batal</button>
                                <button type="submit" class="w-full text-center bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30">Simpan Perubahan</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

        </div>

        <div class="w-full max-w-4xl mx-auto mt-4">
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
    </div>
</body>

</html>