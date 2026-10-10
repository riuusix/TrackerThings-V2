<?php
// --- KEAMANAN - Memulai session dan validasi akses ---
session_start();

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}
// Ambil user_id dari session
$user_id = $_SESSION['user_id'];

require_once 'koneksi.php';

// Pastikan ID tugas ada di URL
if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
    die("Error: ID Tugas tidak valid.");
}
$id_tugas = $_GET['id'];

// --- KEAMANAN - Ambil data tugas HANYA jika ID & user_id cocok ---
$stmt = $conn->prepare("SELECT * FROM tugas WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $id_tugas, $user_id);
$stmt->execute();
$result_tugas = $stmt->get_result();
$tugas = $result_tugas->fetch_assoc();


// Jika tugas tidak ditemukan, hentikan script
if (!$tugas) {
    die("Tugas tidak ditemukan atau Anda tidak memiliki izin untuk mengeditnya.");
}

// --- KEAMANAN - Ambil data matkul HANYA milik user yang login ---
$stmt_matkul = $conn->prepare("SELECT MIN(id) as id, nama_matkul FROM jadwal WHERE user_id = ? GROUP BY nama_matkul ORDER BY nama_matkul ASC");
$stmt_matkul->bind_param("i", $user_id);
$stmt_matkul->execute();
$result_semua_matkul = $stmt_matkul->get_result();

// Simpan hasil ke array agar bisa di-loop beberapa kali
$semua_matkul_arr = [];
while ($row = $result_semua_matkul->fetch_assoc()) {
    $semua_matkul_arr[] = $row;
}

// Ambil nama matkul yang sedang dipilih
$nama_matkul_terpilih = 'Pilih Mata Kuliah';
foreach ($semua_matkul_arr as $matkul) {
    if ($matkul['id'] == $tugas['id_jadwal']) {
        $nama_matkul_terpilih = $matkul['nama_matkul'];
        break;
    }
}
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Tugas</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
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

        .glass-input,
        .glass-dropdown-button {
            background: rgba(229, 231, 235, 0.5) !important;
            border: 1px solid rgba(209, 213, 219, 0.5) !important;
            color: #1f2937 !important;
        }

        .dark .glass-input,
        .dark .glass-dropdown-button {
            background: rgba(55, 65, 81, 0.5) !important;
            border: 1px solid rgba(75, 85, 99, 0.5) !important;
            color: #f3f4f6 !important;
        }

        .glass-dropdown-menu {
            background: rgba(255, 255, 255, 0.7);
            -webkit-backdrop-filter: blur(12px);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.7);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }

        .dark .glass-dropdown-menu {
            background: rgba(35, 48, 68, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        /* Style untuk Flatpickr (sudah disesuaikan di file index) */
        .dark .flatpickr-calendar {
            background: #1f2937;
            border-color: rgba(255, 255, 255, 0.15);
            color: #d1d5db;
        }

        .dark .flatpickr-months .flatpickr-month,
        .dark .flatpickr-weekday,
        .dark .flatpickr-day {
            color: #d1d5db;
        }

        .dark .flatpickr-day:hover {
            background: #374151;
        }

        .dark .flatpickr-day.selected {
            background: #3b82f6;
            border-color: #3b82f6;
            color: #fff;
        }
    </style>
    <script>
        function submitEditTask(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            fetch('edit_tugas.php', {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert(data.message);
                        setTimeout(() => window.location.href = 'index.php', 1000);
                    } else {
                        alert(data.message);
                    }
                })
                .catch(err => console.error('Fetch error:', err));
        }
    </script>

</head>

<body class="flex items-center justify-center min-h-screen p-4 antialiased transition-colors duration-300">

    <div class="glass-card p-8 rounded-2xl shadow-lg w-full max-w-lg">
        <div class="flex items-center gap-3 pb-6 border-b border-black/10 dark:border-white/10 mb-6">
            <svg class="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-200 tracking-tight">Edit Tugas</h1>
        </div>

        <form x-data="{ init() { flatpickr(this.$refs.deadlinePicker, { altInput: true, altFormat: 'F j, Y', dateFormat: 'Y-m-d', defaultDate: '<?php echo $tugas['deadline']; ?>' }); } }" x-init="init()" @submit.prevent="submitEditTask($event)" class="space-y-6">
            <input type="hidden" name="id_tugas" value="<?php echo $tugas['id']; ?>">

            <div>
                <label for="nama_tugas" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Tugas</label>
                <input type="text" name="nama_tugas" id="nama_tugas" value="<?php echo htmlspecialchars($tugas['nama_tugas']); ?>" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
                <input x-ref="deadlinePicker" type="text" name="deadline" placeholder="Pilih tanggal" required class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
            </div>

            <div x-data="{ open: false, selectedId: '<?php echo $tugas['id_jadwal']; ?>', selectedName: '<?php echo htmlspecialchars(addslashes($nama_matkul_terpilih)); ?>' }" class="relative">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Kuliah</label>
                <input type="hidden" name="id_jadwal" x-model="selectedId">
                <button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left focus:ring-2 focus:ring-blue-400 focus:outline-none flex justify-between items-center mt-1">
                    <span x-text="selectedName" class="truncate"></span>
                    <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div x-show="open" @click.away="open = false" x-cloak class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                    <?php foreach ($semua_matkul_arr as $matkul): ?>
                        <a @click="selectedId = <?php echo $matkul['id']; ?>; selectedName = '<?php echo htmlspecialchars(addslashes($matkul['nama_matkul'])); ?>'; open = false;" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"><?php echo htmlspecialchars($matkul['nama_matkul']); ?></a>
                    <?php endforeach; ?>
                </div>
            </div>

            <div x-data="{ open: false, selectedValue: '<?php echo htmlspecialchars($tugas['jenis']); ?>' }" class="relative">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Penugasan</label>
                <input type="hidden" name="jenis" x-model="selectedValue">
                <button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left flex justify-between items-center mt-1">
                    <span x-text="selectedValue"></span>
                    <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div x-show="open" @click.away="open = false" x-cloak class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                    <template x-for="item in ['Tugas', 'Quiz', 'Project', 'UTS', 'UAS']" :key="item"><a @click="selectedValue = item; open = false;" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" x-text="item"></a></template>
                </div>
            </div>

            <!-- PERBAIKAN: Dropdown Prioritas disamakan gayanya -->
            <div x-data="{ open: false, selectedValue: '<?php echo htmlspecialchars($tugas['prioritas']); ?>' }" class="relative">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas</label>
                <input type="hidden" name="prioritas" x-model="selectedValue">
                <button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left flex justify-between items-center mt-1">
                    <span x-text="selectedValue"></span>
                    <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                    </svg>
                </button>
                <div x-show="open" @click.away="open = false" x-cloak class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                    <template x-for="item in ['Rendah 🟢', 'Sedang 🟠', 'Tinggi 🔴']" :key="item"><a @click="selectedValue = item; open = false;" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" x-text="item"></a></template>
                </div>
            </div>

            <div class="flex items-center gap-4 pt-4">
                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 shadow-lg shadow-blue-500/30 dark:shadow-blue-800/30 transition-all active:scale-[0.98]">Simpan Perubahan</button>
                <a href="index.php" class="w-full text-center bg-gray-200 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600/50 transition-all">Batal</a>
            </div>
        </form>
    </div>
</body>

</html>