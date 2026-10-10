<?php
require_once 'koneksi.php';
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}
$user_id = $_SESSION['user_id'];

// Ambil semua kelas pengganti yang sudah selesai atau terlewat
$stmt = $conn->prepare("
    SELECT kp.*, j.nama_matkul, j.kategori 
    FROM kelas_pengganti kp 
    JOIN jadwal j ON kp.id_jadwal = j.id 
    WHERE (kp.status = 'Selesai' OR kp.tanggal < CURDATE()) AND kp.user_id = ? 
    ORDER BY kp.tanggal DESC, kp.waktu_mulai DESC
");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$history = $stmt->get_result();
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Riwayat Kelas Pengganti</title>
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
    </style>
</head>

<body class="p-4 sm:p-6 lg:p-8 antialiased">
    <div class="max-w-md md:max-w-4xl mx-auto">
        <div class="glass-card p-4 sm:p-6 lg:p-8 rounded-2xl">
            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Riwayat Kelas Pengganti</h1>
            <p class="mt-1 text-gray-600 dark:text-gray-400">Daftar semua kelas pengganti yang telah selesai atau terlewat.</p>

            <div class="mt-6 overflow-x-auto hidden md:block">
                <table class="min-w-full">
                    <thead class="bg-black/5 dark:bg-white/5">
                        <tr>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Mata Kuliah</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Waktu</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Lokasi</th>
                            <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Catatan</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-black/10 dark:divide-white/10">
                        <?php if ($history->num_rows > 0): ?>
                            <?php while ($row = $history->fetch_assoc()): ?>
                                <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                    <td class="py-4 px-4 whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100"><?php echo htmlspecialchars($row['nama_matkul']); ?></td>
                                    <td class="py-4 px-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"><?php echo date('d M Y', strtotime($row['tanggal'])); ?></td>
                                    <td class="py-4 px-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"><?php echo htmlspecialchars(substr($row['waktu_mulai'], 0, 5) . ' - ' . substr($row['waktu_selesai'], 0, 5)); ?></td>
                                    <td class="py-4 px-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"><?php echo htmlspecialchars($row['lokasi'] ?: '-'); ?></td>
                                    <td class="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title="<?php echo htmlspecialchars($row['catatan']); ?>"><?php echo htmlspecialchars($row['catatan'] ?: '-'); ?></td>
                                </tr>
                            <?php endwhile; ?>
                        <?php else: ?>
                            <tr>
                                <td colspan="5" class="text-center py-12 text-gray-500 dark:text-gray-400">Tidak ada riwayat kelas pengganti yang ditemukan.</td>
                            </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            <div class="mt-6 block md:hidden space-y-4">
                <?php
                // Reset pointer result set untuk loop lagi
                mysqli_data_seek($history, 0);

                // Cek lagi jika ada data (khusus untuk loop mobile)
                if (mysqli_num_rows($history) > 0):
                    while ($row = $history->fetch_assoc()):
                ?>
                        <div class="glass-card p-4 rounded-lg shadow-sm">
                            <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-lg break-words mb-2">
                                <?php echo htmlspecialchars($row['nama_matkul']); ?>
                            </h3>

                            <div class="grid grid-cols-3 gap-x-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
                                <div>
                                    <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Tanggal</span>
                                    <?php echo date('d M Y', strtotime($row['tanggal'])); ?>
                                </div>
                                <div>
                                    <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Waktu</span>
                                    <?php echo htmlspecialchars(substr($row['waktu_mulai'], 0, 5) . ' - ' . substr($row['waktu_selesai'], 0, 5)); ?>
                                </div>
                                <div>
                                    <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Lokasi</span>
                                    <?php echo htmlspecialchars($row['lokasi'] ?: '-'); ?>
                                </div>
                            </div>

                            <?php if (!empty($row['catatan'])): ?>
                                <div class="mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                                    <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Catatan</span>
                                    <p class="text-sm text-gray-700 dark:text-gray-200 break-words">
                                        <?php echo htmlspecialchars($row['catatan']); ?>
                                    </p>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php
                    endwhile;
                else: // Jika tidak ada data sama sekali
                    ?>
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        Tidak ada riwayat kelas pengganti yang ditemukan.
                    </div>
                <?php endif; // Tutup if num_rows > 0 
                ?>
            </div>
        </div>

        <div class="mt-8">
            <a href="index.php" class="font-medium text-blue-600 hover:underline dark:text-blue-400">← Kembali ke Dashboard</a>
        </div>
    </div>
    </div>

    <script>
        setInterval(() => {
            fetch('/keepalive.php', {
                    credentials: 'include'
                })
                .then(r => r.text())
                .then(console.log)
                .catch(console.error);
        }, 5 * 60 * 1000); // tiap 5 menit

        function checkSession() {
            fetch('check_session.php')
                .then(res => res.json())
                .then(data => {
                    if (!data.active) {
                        alert('Sesi kamu sudah habis, silakan login ulang.');
                        window.location.href = 'login.php';
                    }
                });
        }

        // tiap 1 menit, cek apakah session masih aktif
        setInterval(checkSession, 60000);

        // tiap 2 menit, kirim ping biar session gak mati
        setInterval(() => fetch('keepalive.php'), 120000);
    </script>

</body>

</html>