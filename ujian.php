<?php
require_once 'koneksi.php';

// --- PERBAIKAN 1: Memulai session dan mengamankan halaman ---
// session_start();

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit(); // Penting untuk menghentikan eksekusi script setelah redirect
}

// Ambil user_id dari session untuk digunakan di query
$user_id = $_SESSION['user_id'];

// --- NOTIFICATION LOGIC ---
$notificationMessage = '';
$notificationType = '';

if (isset($_GET['status'])) {
    switch ($_GET['status']) {
        case 'sukses_tambah':
            $notificationMessage = 'Jadwal ujian baru berhasil ditambahkan!';
            $notificationType = 'success';
            break;
        case 'sukses_edit':
            $notificationMessage = 'Jadwal ujian berhasil diperbarui!';
            $notificationType = 'success';
            break;
        case 'dihapus':
            $notificationMessage = 'Jadwal ujian telah berhasil dihapus.';
            $notificationType = 'delete';
            break;
    }
}


// --- PERBAIKAN 2: Menggunakan Prepared Statement yang difilter berdasarkan user_id ---
// Query untuk mengambil data ujian milik user yang sedang login
$query = "SELECT u.*, j.nama_matkul 
          FROM ujian u 
          JOIN jadwal j ON u.id_jadwal = j.id 
          WHERE u.user_id = ? 
          ORDER BY u.tanggal ASC, u.waktu_mulai ASC";

// Siapkan, ikat parameter, eksekusi, dan ambil hasilnya
$stmt = $conn->prepare($query);
if (!$stmt) {
    die("Prepare failed: (" . $conn->errno . ") " . $conn->error);
}

$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8" meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kelola Jadwal Ujian</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
        }
    </script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@5/dark.css" id="swal2-dark-theme" disabled>
    <style>
        @import url('https://rsms.me/inter/inter.css');

        html {
            font-family: 'Inter', sans-serif;
        }

        [x-cloak] {
            display: none !important;
        }

        /* --- STATIC LIQUID GLASS BACKGROUNDS --- */
        body {
            background-color: #f0f4f9;
            background-image:
                radial-gradient(at 0% 0%, hsla(214, 80%, 95%, 1) 0px, transparent 50%),
                radial-gradient(at 100% 0%, hsla(280, 80%, 95%, 1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, hsla(190, 80%, 95%, 1) 0px, transparent 50%),
                radial-gradient(at 0% 100%, hsla(340, 80%, 95%, 1) 0px, transparent 50%);
            transition: background-image 0.5s ease-in-out;
        }

        .dark body {
            background-color: #0d1117;
            background-image:
                radial-gradient(at 0% 0%, hsla(220, 40%, 12%, 1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, hsla(260, 40%, 12%, 1) 0px, transparent 50%);
        }

        /* --- EFEK KACA (GLASSMORPHISM) --- */
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

        .glass-button:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        .dark .glass-button:hover {
            background: rgba(31, 41, 55, 0.8);
        }
    </style>

    <script>
        document.addEventListener('alpine:init', () => {
            Alpine.watch('darkMode', value => {
                document.getElementById('swal2-dark-theme').disabled = !value;
            });
            // Set initial theme based on Alpine's darkMode
            document.getElementById('swal2-dark-theme').disabled = !Alpine.store('darkMode');
            // Gunakan Alpine.store jika darkMode didefinisikan secara global
            // Jika tidak, pakai: !JSON.parse(localStorage.getItem('darkMode') || 'false');
        });

        function confirmDeleteSweetAlert(event) {
            // 1. Cegah link langsung jalan
            event.preventDefault();

            // 2. Simpan URL tujuan
            const deleteUrl = event.target.href;

            // 3. Tampilkan SweetAlert
            Swal.fire({
                title: 'Konfirmasi Hapus',
                text: "Yakin mau hapus mata kuliah ini? Menghapus ini bisa mempengaruhi jadwal, tugas, dan ujian terkait. Tindakan ini tidak dapat dibatalkan.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33', // Merah
                cancelButtonColor: '#6b7280', // Abu-abu
                confirmButtonText: 'Ya, Hapus!',
                cancelButtonText: 'Batal',
                customClass: { // Menyesuaikan dengan dark mode jika aktif
                    popup: document.documentElement.classList.contains('dark') ? 'swal2-dark' : '',
                }
            }).then((result) => {
                // 4. Jika user klik "Ya, Hapus!"
                if (result.isConfirmed) {
                    // Arahkan ke URL hapus
                    window.location.href = deleteUrl;
                }
            });
        }
    </script>

</head>

<body class="p-8 antialiased transition-colors duration-300">
    <div x-data="{ show: false, message: '', type: '' }" x-init="
            <?php if ($notificationMessage): ?>
                message = '<?php echo $notificationMessage; ?>';
                type = '<?php echo $notificationType; ?>';
                show = true;
                setTimeout(() => show = false, 4000);
            <?php endif; ?>
        " x-show="show" x-transition:enter="transform ease-out duration-300 transition" x-transition:enter-start="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" x-transition:enter-end="translate-y-0 opacity-100 sm:translate-x-0" x-transition:leave="transition ease-in duration-100" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0"
        x-cloak class="fixed top-5 right-5 w-full max-w-sm z-50">
        <div class="glass-card p-4 rounded-lg pointer-events-auto">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg x-show="type === 'success'" class="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <svg x-show="type === 'delete'" class="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div class="ml-3 w-0 flex-1 pt-0.5">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100" x-text="message"></p>
                </div>
                <div class="ml-4 flex-shrink-0 flex"><button @click="show = false" class="rounded-md inline-flex text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 focus:outline-none"><span class="sr-only">Close</span><svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg></button></div>
            </div>
        </div>
    </div>

    <header class="mb-8 flex justify-between items-center">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md">Kelola Jadwal Ujian</h1>
        <div class="flex items-center gap-4">
            <a href="tambah_ujian.php" class="bg-blue-600 text-white font-semibold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg hover:bg-blue-700 transition-all shadow-md">Tambah Ujian Baru</a>
            <button @click="darkMode = !darkMode" class="glass-button text-gray-800 dark:text-gray-200 p-2 rounded-full transition-colors" title="Toggle Dark Mode">
                <svg x-show="!darkMode" x-cloak class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg x-show="darkMode" x-cloak class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            </button>
        </div>
    </header>

    <div class="w-full mx-auto glass-card p-4 sm:p-6 lg:p-8 rounded-2xl">
        <div class="overflow-x-auto hidden md:block">
            <table class="min-w-full">
                <thead class="bg-black/5 dark:bg-white/5">
                    <tr>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Mata Kuliah</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Jenis Ujian</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Jadwal</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Ruangan</th>
                        <th class="py-3 px-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Catatan</th>
                        <th class="py-3 px-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-black/10 dark:divide-white/10">
                    <?php if ($result->num_rows > 0): ?>
                        <?php while ($row = $result->fetch_assoc()): ?>
                            <tr class="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <td class="py-4 px-4 whitespace-nowrap"><span class="font-semibold text-gray-800 dark:text-gray-100"><?php echo htmlspecialchars($row['nama_matkul']); ?></span></td>
                                <td class="py-4 px-4 whitespace-nowrap">
                                    <span class="px-2 py-1 text-xs font-bold leading-none text-white rounded-md <?php
                                                                                                                if ($row['jenis_ujian'] == 'UTS') echo 'bg-orange-500';
                                                                                                                elseif ($row['jenis_ujian'] == 'UAS') echo 'bg-red-500';
                                                                                                                else echo 'bg-blue-500'; ?>">
                                        <?php echo htmlspecialchars($row['jenis_ujian']); ?>
                                    </span>
                                </td>
                                <td class="py-4 px-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                    <?php echo date('d M Y', strtotime($row['tanggal'])); ?>,
                                    <?php echo substr($row['waktu_mulai'], 0, 5); ?> - <?php echo substr($row['waktu_selesai'], 0, 5); ?>
                                </td>
                                <td class="py-4 px-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300"><?php echo htmlspecialchars($row['ruangan'] ?: '-'); ?></td>
                                <td class="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title="<?php echo htmlspecialchars($row['catatan']); ?>"><?php echo htmlspecialchars($row['catatan'] ?: '-'); ?></td>
                                <td class="py-4 px-4 whitespace-nowrap text-right text-sm font-medium">
                                    <a href="edit_ujian.php?id=<?php echo $row['id']; ?>" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4">Edit</a>
                                    <a href="hapus_ujian.php?id=<?php echo $row['id']; ?>" onclick="return confirm('Yakin mau hapus jadwal ujian ini?')" class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">Hapus</a>
                                </td>
                            </tr>
                        <?php endwhile; ?>
                    <?php else: ?>
                        <tr>
                            <td colspan="6" class="text-center py-12 text-gray-500 dark:text-gray-400">Belum ada jadwal ujian yang ditambahkan.</td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <div class="block md:hidden space-y-4">
            <?php
            // Reset pointer result set untuk loop lagi
            mysqli_data_seek($result, 0);

            // Cek lagi jika ada data (khusus untuk loop mobile)
            if (mysqli_num_rows($result) > 0):
                while ($row = $result->fetch_assoc()):
                    // Tentukan warna tag jenis ujian
                    $jenis_ujian_color = 'bg-blue-500'; // Default
                    if ($row['jenis_ujian'] == 'UTS') $jenis_ujian_color = 'bg-orange-500';
                    elseif ($row['jenis_ujian'] == 'UAS') $jenis_ujian_color = 'bg-red-500';
            ?>
                    <div class="glass-card p-4 rounded-lg shadow-sm">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h3 class="font-semibold text-gray-800 dark:text-gray-100 text-lg break-words mb-1">
                                    <?php echo htmlspecialchars($row['nama_matkul']); ?>
                                </h3>
                                <span class="px-2 py-1 text-xs font-bold leading-none text-white rounded-md <?php echo $jenis_ujian_color; ?>">
                                    <?php echo htmlspecialchars($row['jenis_ujian']); ?>
                                </span>
                            </div>
                            <div class="flex-shrink-0 space-x-3 mt-1">
                                <a href="edit_ujian.php?id=<?php echo $row['id']; ?>" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">Edit</a>
                                <a href="hapus_ujian.php?id=<?php echo $row['id']; ?>"
                                    onclick="confirmDeleteSweetAlert(event)"
                                    class="text-red-600 dark:text-red-400 hover:underline text-sm">Hapus</a>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-x-3 text-sm text-gray-600 dark:text-gray-300 mb-2">
                            <div>
                                <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Jadwal</span>
                                <?php echo date('d M Y', strtotime($row['tanggal'])); ?><br>
                                <?php echo substr($row['waktu_mulai'], 0, 5); ?> - <?php echo substr($row['waktu_selesai'], 0, 5); ?>
                            </div>
                            <div>
                                <span class="font-medium text-gray-500 dark:text-gray-400 block text-xs">Ruangan</span>
                                <?php echo htmlspecialchars($row['ruangan'] ?: '-'); ?>
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
                    Belum ada jadwal ujian yang ditambahkan.
                </div>
            <?php endif; // Tutup if num_rows > 0 
            ?>
        </div>
    </div>
    <div class="mt-6">
        <a href="index.php" class="text-blue-600 dark:text-blue-400 hover:underline">← Kembali ke Dashboard</a>
    </div>
    </div>
</body>

</html>