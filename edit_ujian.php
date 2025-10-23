<?php
// --- KEAMANAN - Memulai session dan validasi akses ---
// session_start();
require_once 'koneksi.php';

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}
// Ambil user_id dari session
$user_id = $_SESSION['user_id'];

require_once 'koneksi.php';

// Ambil ID ujian dari URL dan pastikan itu adalah angka
$id_ujian = $_GET['id'] ?? null;
if (!$id_ujian || !is_numeric($id_ujian)) {
    // Jika ID tidak valid, kembalikan ke halaman utama ujian
    header("Location: ujian.php");
    exit();
}

// --- PERBAIKAN 1: Ambil data ujian HANYA jika ID & user_id cocok ---
$stmt = $conn->prepare("SELECT * FROM ujian WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $id_ujian, $user_id);
$stmt->execute();
$result = $stmt->get_result();
$ujian = $result->fetch_assoc();

// Jika data tidak ditemukan (karena ID salah atau bukan milik user ini), hentikan script
if (!$ujian) {
    die("Data ujian tidak ditemukan atau Anda tidak memiliki izin untuk mengaksesnya.");
}

// --- PERBAIKAN 2: Ambil daftar matkul HANYA milik user yang login ---
// --- PERBAIKAN 3: Gunakan MIN(id) untuk mencegah error 'only_full_group_by' ---
$stmt_matkul = $conn->prepare("SELECT MIN(id) as id, nama_matkul FROM jadwal WHERE user_id = ? GROUP BY nama_matkul ORDER BY nama_matkul ASC");
$stmt_matkul->bind_param("i", $user_id);
$stmt_matkul->execute();
$result_semua_matkul = $stmt_matkul->get_result();

?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }"
    x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))"
    :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <title>Edit Jadwal Ujian</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <style>
        @import url('https://rsms.me/inter/inter.css');

        html {
            font-family: 'Inter', sans-serif;
        }

        [x-cloak] {
            display: none !important;
        }

        .flatpickr-calendar {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            border: 1px solid #e5e7eb;
        }

        .dark .flatpickr-calendar {
            background: #1f2937;
            border-color: #374151;
        }

        .flatpickr-day.selected {
            background: #3b82f6;
            border-color: #3b82f6;
        }

        .dark .flatpickr-day.selected {
            background: #60a5fa;
        }
    </style>
</head>

<body class="bg-gray-100 dark:bg-gray-900 flex items-center justify-center min-h-screen p-4 antialiased">
    <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg w-full max-w-2xl">
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6">Edit Jadwal Ujian</h1>

        <form x-data="{ 
                init() { 
                    flatpickr(this.$refs.tanggal, { altInput: true, altFormat: 'F j, Y', dateFormat: 'Y-m-d', defaultDate: '<?= $ujian['tanggal']; ?>' });
                    flatpickr(this.$refs.waktu_mulai, { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true, defaultDate: '<?= $ujian['waktu_mulai']; ?>' });
                    flatpickr(this.$refs.waktu_selesai, { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true, defaultDate: '<?= $ujian['waktu_selesai']; ?>' });
                } 
            }" action="proses_edit_ujian.php" method="POST" class="space-y-6">

            <input type="hidden" name="id" value="<?= $ujian['id'] ?>">

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Mata Kuliah</label>
                    <select name="id_jadwal"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                        <option value="">-- Pilih Mata Kuliah --</option>
                        <?php while ($row = $result_semua_matkul->fetch_assoc()): ?>
                            <option value="<?= $row['id'] ?>" <?= $ujian['id_jadwal'] == $row['id'] ? 'selected' : '' ?>>
                                <?= htmlspecialchars($row['nama_matkul']) ?>
                            </option>
                        <?php endwhile; ?>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Jenis Ujian</label>
                    <select name="jenis_ujian"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                        <option value="UTS" <?= $ujian['jenis_ujian'] == 'UTS' ? 'selected' : '' ?>>UTS</option>
                        <option value="UAS" <?= $ujian['jenis_ujian'] == 'UAS' ? 'selected' : '' ?>>UAS</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Tanggal</label>
                    <input x-ref="tanggal" type="text" name="tanggal"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Mulai</label>
                    <input x-ref="waktu_mulai" type="text" name="waktu_mulai"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Selesai</label>
                    <input x-ref="waktu_selesai" type="text" name="waktu_selesai"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Ruangan</label>
                    <input type="text" name="ruangan" value="<?= htmlspecialchars($ujian['ruangan']) ?>"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                </div>
                <div class="sm:col-span-2">
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Catatan</label>
                    <textarea name="catatan" rows="3"
                        class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"><?= htmlspecialchars($ujian['catatan']) ?></textarea>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-4 pt-4">
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">
                    Simpan Perubahan
                </button>
                <a href="ujian.php" class="w-full text-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium px-4 py-2 rounded-lg transition">
                    Batal
                </a>
            </div>
        </form>
    </div>
</body>

</html>