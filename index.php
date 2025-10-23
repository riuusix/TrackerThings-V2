<?php
require_once 'koneksi.php';

// --- Memulai session dan mengamankan halaman ---
// session_start();
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}
$user_id = $_SESSION['user_id'];

// --- Menampilkan semua error PHP untuk debugging ---
ini_set('display_errors', 1);
error_reporting(E_ALL);


if ($conn->connect_error) {
    die("Koneksi Gagal: " . $conn->connect_error);
}

//logika notif baru
// ... (setelah kode cek koneksi)

// ▼▼▼ TAMBAHKAN BLOK LOGIKA NOTIFIKASI INI ▼▼▼
$daftar_notifikasi = [];

// 1. Dapatkan Tugas (Hari Ini & Besok)
$stmt_noti_tugas = $conn->prepare(
    "SELECT t.nama_tugas, j.nama_matkul, t.deadline, 'Tugas' as tipe 
     FROM tugas t 
     JOIN jadwal j ON t.id_jadwal = j.id 
     WHERE t.user_id = ? AND t.status != 'Selesai' 
     AND DATE(t.deadline) >= CURDATE() 
     AND DATE(t.deadline) <= CURDATE() + INTERVAL 1 DAY"
);
$stmt_noti_tugas->bind_param("i", $user_id);
$stmt_noti_tugas->execute();
$result_noti_tugas = $stmt_noti_tugas->get_result();
while ($row = $result_noti_tugas->fetch_assoc()) {
    $daftar_notifikasi[] = $row;
}
$stmt_noti_tugas->close();

// 2. Dapatkan Ujian (Hari Ini & Besok)
$stmt_noti_ujian = $conn->prepare(
    "SELECT j.nama_matkul, u.tanggal, 'Ujian' as tipe 
     FROM ujian u 
     JOIN jadwal j ON u.id_jadwal = j.id 
     WHERE u.user_id = ? 
     AND DATE(u.tanggal) >= CURDATE() 
     AND DATE(u.tanggal) <= CURDATE() + INTERVAL 1 DAY"
);
$stmt_noti_ujian->bind_param("i", $user_id);
$stmt_noti_ujian->execute();
$result_noti_ujian = $stmt_noti_ujian->get_result();
while ($row = $result_noti_ujian->fetch_assoc()) {
    $daftar_notifikasi[] = $row;
}
$stmt_noti_ujian->close();

// 3. Urutkan semua notifikasi berdasarkan tanggal
usort($daftar_notifikasi, function ($a, $b) {
    $dateA = $a['deadline'] ?? $a['tanggal'];
    $dateB = $b['deadline'] ?? $b['tanggal'];
    return strtotime($dateA) - strtotime($dateB);
});
// ▲▲▲ BATAS BLOK NOTIFIKASI ▲▲▲

//logika profile
$stmt_user_pic = $conn->prepare("SELECT profile_picture_url FROM users WHERE id = ?");
$stmt_user_pic->bind_param("i", $user_id);
$stmt_user_pic->execute();
$user_data = $stmt_user_pic->get_result()->fetch_assoc();
$stmt_user_pic->close();

// --- LOGIKA PENGAMBILAN DATA GABUNGAN UNTUK JADWAL ---
$daftar_hari = ['Monday' => 'Senin', 'Tuesday' => 'Selasa', 'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat', 'Saturday' => 'Sabtu', 'Sunday' => 'Minggu'];
$hari_ini_english = date('l');
$hari_terpilih_indonesia = isset($_GET['hari']) ? $_GET['hari'] : $daftar_hari[$hari_ini_english];

// 1. Tentukan tanggal spesifik berdasarkan hari yang dipilih
$nama_hari_indonesia = $daftar_hari[$hari_ini_english];
$offset_hari = array_search($hari_terpilih_indonesia, array_values($daftar_hari)) - array_search($nama_hari_indonesia, array_values($daftar_hari));
$tanggal_terpilih = date('Y-m-d', strtotime("$offset_hari days"));

$jadwal_gabungan = []; // Array ini akan menampung jadwal reguler dan pengganti

// 2. Ambil Jadwal Reguler untuk hari yang dipilih
$stmt_jadwal = $conn->prepare("SELECT *, 'reguler' as tipe FROM jadwal WHERE hari = ? AND user_id = ?");
$stmt_jadwal->bind_param("si", $hari_terpilih_indonesia, $user_id);
$stmt_jadwal->execute();
$result_jadwal = $stmt_jadwal->get_result();
while ($row = $result_jadwal->fetch_assoc()) {
    $jadwal_gabungan[] = $row;
}

// 3. Ambil Kelas Pengganti untuk tanggal yang dipilih
$stmt_pengganti = $conn->prepare("SELECT kp.*, j.nama_matkul, j.kategori, 'pengganti' as tipe FROM kelas_pengganti kp JOIN jadwal j ON kp.id_jadwal = j.id WHERE kp.tanggal = ? AND kp.user_id = ? AND kp.status != 'Selesai'");
$stmt_pengganti->bind_param("si", $tanggal_terpilih, $user_id);
$stmt_pengganti->execute();
$result_pengganti = $stmt_pengganti->get_result();
while ($row = $result_pengganti->fetch_assoc()) {
    $jadwal_gabungan[] = $row;
}

// 4. Urutkan jadwal gabungan berdasarkan waktu mulai agar kronologis
usort($jadwal_gabungan, function ($a, $b) {
    return strcmp($a['waktu_mulai'], $b['waktu_mulai']);
});


// --- Sisa Query Anda (tidak berubah) ---
// Query Matkul untuk dropdown
$stmt_semua_matkul = $conn->prepare("SELECT MIN(id) as id, nama_matkul FROM jadwal WHERE user_id = ? GROUP BY nama_matkul ORDER BY nama_matkul ASC");
$stmt_semua_matkul->bind_param("i", $user_id);
$stmt_semua_matkul->execute();
$result_semua_matkul = $stmt_semua_matkul->get_result();

// Query Ujian terdekat
$stmt_ujian = $conn->prepare("SELECT u.*, j.nama_matkul FROM ujian u JOIN jadwal j ON u.id_jadwal = j.id WHERE u.tanggal >= CURDATE() AND u.user_id = ? ORDER BY u.tanggal ASC, u.waktu_mulai ASC LIMIT 3");
$stmt_ujian->bind_param("i", $user_id);
$stmt_ujian->execute();
$ujian_terdekat = $stmt_ujian->get_result()->fetch_assoc();

// Query Tugas Belum Selesai
$tugas_belum_selesai = [];
$status_selesai = 'Selesai';
$stmt_tugas_belum = $conn->prepare("SELECT t.*, j.nama_matkul FROM tugas t JOIN jadwal j ON t.id_jadwal = j.id WHERE t.status != ? AND t.user_id = ? ORDER BY t.deadline ASC");
$stmt_tugas_belum->bind_param("si", $status_selesai, $user_id);
$stmt_tugas_belum->execute();
$result_tugas = $stmt_tugas_belum->get_result();
if ($result_tugas) {
    while ($row = $result_tugas->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['progress'] = (int)$row['progress'];
        $tugas_belum_selesai[] = $row;
    }
}

// Query Tugas Selesai
$tugas_sudah_selesai = [];
$stmt_tugas_sudah = $conn->prepare("SELECT t.*, j.nama_matkul FROM tugas t JOIN jadwal j ON t.id_jadwal = j.id WHERE t.status = ? AND t.user_id = ? ORDER BY t.deadline DESC");
$stmt_tugas_sudah->bind_param("si", $status_selesai, $user_id);
$stmt_tugas_sudah->execute();
$result_tugas_selesai = $stmt_tugas_sudah->get_result();
if ($result_tugas_selesai) {
    while ($row = $result_tugas_selesai->fetch_assoc()) {
        $row['id'] = (int)$row['id'];
        $row['progress'] = (int)$row['progress'];
        $tugas_sudah_selesai[] = $row;
    }
}

// --- Data semua mata kuliah untuk dropdown di modal edit ---
$stmt_matkul_all = $conn->prepare("
    SELECT MIN(id) as id, nama_matkul 
    FROM jadwal 
    WHERE user_id = ? 
    GROUP BY nama_matkul 
    ORDER BY nama_matkul ASC
");
$stmt_matkul_all->bind_param("i", $user_id);
$stmt_matkul_all->execute();
$result_matkul_all = $stmt_matkul_all->get_result();

$semua_matkul_arr = [];
while ($row = $result_matkul_all->fetch_assoc()) {
    $semua_matkul_arr[] = $row;
}


?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Student Dashboard</title>
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

        .glass-input,
        .glass-dropdown-button {
            background: rgba(255, 255, 255, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            color: #1f2937 !important;
        }

        .dark .glass-input,
        .dark .glass-dropdown-button {
            background: rgba(17, 24, 39, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: #f3f4f6 !important;
        }

        /* --- REVISI: Flatpickr Dark Mode Theme --- */
        .flatpickr-calendar {
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }

        .dark .flatpickr-calendar {
            background: #1f2937;
            border-color: rgba(255, 255, 255, 0.15);
            color: #d1d5db;
        }

        .dark .flatpickr-months .flatpickr-month,
        .dark .flatpickr-current-month .numInputWrapper,
        .dark .flatpickr-weekday,
        .dark .flatpickr-day {
            color: #d1d5db;
        }

        .dark .flatpickr-months .flatpickr-prev-month,
        .dark .flatpickr-months .flatpickr-next-month {
            fill: #d1d5db;
        }

        .dark .flatpickr-day:hover,
        .dark .flatpickr-day:focus {
            background: #374151;
        }

        .dark .flatpickr-day.today {
            border-color: #6b7280;
        }

        .dark .flatpickr-day.selected,
        .dark .flatpickr-day.startRange,
        .dark .flatpickr-day.endRange {
            background: #3b82f6;
            border-color: #3b82f6;
            color: #fff;
        }

        .dark .flatpickr-day.disabled,
        .dark .flatpickr-day.disabled:hover {
            color: #4b5563;
            background: transparent;
        }

        .dark .numInput {
            color: inherit;
            background: transparent;
        }

        .dark .numInput:hover,
        .dark .arrowUp:hover,
        .dark .arrowDown:hover {
            background: #374151 !important;
        }
    </style>
    <!-- PERBAIKAN: Pindahkan script logic AlpineJS ke dalam <head> -->
    <script>
        function notificationSystem() {
            return {
                show: false,
                message: '',
                type: 'success',
                init() {
                    window.addEventListener('show-notification', event => {
                        this.showNotification(event.detail.message, event.detail.type);
                    });
                },
                showNotification(msg, notificationType = 'success') {
                    this.message = msg;
                    this.type = notificationType;
                    this.show = true;
                    setTimeout(() => this.show = false, 4000);
                }
            }
        }


        function taskManager(initialUrgent, initialCompleted) {
            return {
                urgentTasks: initialUrgent,
                completedTasks: initialCompleted,
                isModalOpen: false,
                isKelasPenggantiModalOpen: false,
                // ▼▼▼ TAMBAHKAN DUA BARIS INI ▼▼▼
                isDeleteModalOpen: false, // Untuk mengontrol modal hapus
                taskToDeleteId: null, // Untuk menyimpan ID tugas yang akan dihapus
                // ▲▲▲ BATAS TAMBAHAN ▲▲▲
                // ▼▼▼ TAMBAHKAN DUA BARIS INI ▼▼▼
                isSelesaikanModalOpen: false, // Untuk modal konfirmasi selesai
                kelasToSelesaikanId: null, // Untuk menyimpan ID kelas
                // ▲▲▲ BATAS TAMBAHAN ▲▲▲
                deadlinePicker: null,

                openModal() {
                    this.isModalOpen = true;

                    this.$nextTick(() => {
                        if (!this.deadlinePicker) {
                            this.deadlinePicker = flatpickr(this.$refs.deadlinePickerModal, {
                                altInput: true,
                                altFormat: 'F j, Y',
                                dateFormat: 'Y-m-d'
                            });
                        }
                    });
                },
                closeModal() {
                    this.isModalOpen = false;
                },

                addNewTask(event) {
                    const formData = new FormData(event.target);
                    fetch('tambah_tugas.php', {
                            method: 'POST',
                            body: formData
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                this.urgentTasks.unshift(data.newTask);
                                this.closeModal();
                                this.showNotification('Tugas baru berhasil ditambahkan!');
                                event.target.reset();
                            } else {
                                this.showNotification(data.message || 'Gagal menambahkan tugas.', 'delete');
                            }
                        })
                        .catch(() => this.showNotification('Terjadi kesalahan jaringan.', 'delete'));
                },

                // ✅ DENGAN DUA FUNGSI BARU INI:
                deleteTask(taskId) {
                    // Fungsi ini sekarang HANYA membuka modal konfirmasi
                    this.taskToDeleteId = taskId;
                    this.isDeleteModalOpen = true;
                },

                executeDelete() {
                    // Fungsi baru ini yang akan menjalankan penghapusan
                    if (!this.taskToDeleteId) return; // Keamanan

                    const taskId = this.taskToDeleteId;

                    // PINDAHKAN logika fetch kamu ke sini
                    fetch('hapus_tugas.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: `id_tugas=${taskId}`
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                this.urgentTasks = this.urgentTasks.filter(task => task.id !== taskId);
                                this.showNotification(data.message, 'delete');
                            } else {
                                this.showNotification(data.message, 'delete');
                            }
                        })
                        .catch(() => this.showNotification('Terjadi kesalahan jaringan.', 'delete'));

                    // Tutup modal setelah selesai
                    this.closeDeleteModal();
                },

                closeDeleteModal() {
                    this.isDeleteModalOpen = false;
                    this.taskToDeleteId = null;
                },
                updateProgress(taskId, newProgress) {
                    fetch('update_progress.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: `id_tugas=${taskId}&progress=${newProgress}`
                        })
                        .then(async res => {
                            const text = await res.text();
                            console.log('Raw response update_progress:', text);

                            let data;
                            try {
                                data = JSON.parse(text);
                            } catch (e) {
                                console.error('Gagal parse JSON. Raw response:', text);
                                this.showNotification('Respons server tidak valid (lihat console).', 'delete');
                                return;
                            }

                            if (data.debug_output) {
                                console.warn('=== debug_output dari server ===\n', data.debug_output);
                            }

                            if (data.status === 'success') {
                                const taskIndex = this.urgentTasks.findIndex(t => t.id === taskId);
                                if (taskIndex === -1) return;

                                if (newProgress === 100) {
                                    const completedTask = this.urgentTasks.splice(taskIndex, 1)[0];
                                    completedTask.progress = 100;
                                    completedTask.status = 'Selesai';
                                    this.completedTasks.unshift(completedTask);

                                    // ✅ Tampilkan notifikasi sukses
                                    this.showNotification('Tugas selesai! Kerja bagus!', 'success');
                                } else {
                                    this.urgentTasks[taskIndex].progress = newProgress;
                                    this.urgentTasks[taskIndex].status = 'Sedang Dikerjakan';

                                    // ✅ Notifikasi update progress
                                    this.showNotification('Progress tugas diperbarui.', 'success');
                                }
                            } else {
                                // ❌ Notifikasi error
                                this.showNotification(data.message || 'Gagal memperbarui progress.', 'delete');
                            }
                        })
                        .catch(error => {
                            console.error('Error saat update progress:', error);
                            this.showNotification('Terjadi kesalahan jaringan.', 'delete');
                        });
                },
                showNotification(message, type = 'success') {
                    window.dispatchEvent(new CustomEvent('show-notification', {
                        detail: {
                            message,
                            type
                        }
                    }));
                },

                getTaskTypeColor(jenis) {
                    switch (jenis) {
                        case 'UTS':
                        case 'UAS':
                            return 'bg-red-500';
                        case 'Project':
                            return 'bg-purple-500';
                        case 'Quiz':
                            return 'bg-yellow-500';
                        default:
                            return 'bg-blue-500';
                    }
                },

                getDeadlineInfo(deadline) {
                    const deadlineDate = new Date(deadline);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffTime = deadlineDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) return {
                        text: 'Telah Lewat',
                        color: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                    };
                    if (diffDays === 0) return {
                        text: 'Hari Ini!',
                        color: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                    };
                    if (diffDays <= 3) return {
                        text: `${diffDays} hari lagi`,
                        color: 'bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                    };
                    return {
                        text: deadlineDate.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        }),
                        color: 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                    };
                },

                openKelasPenggantiModal() {
                    this.isKelasPenggantiModalOpen = true;
                    this.$nextTick(() => {
                        // Inisialisasi date & time picker untuk modal kelas pengganti
                        flatpickr(this.$refs.tanggalPengganti, {
                            altInput: true,
                            altFormat: 'F j, Y',
                            dateFormat: 'Y-m-d'
                        });
                        flatpickr(this.$refs.waktuMulaiPengganti, {
                            enableTime: true,
                            noCalendar: true,
                            dateFormat: "H:i",
                            time_24hr: true
                        });
                        flatpickr(this.$refs.waktuSelesaiPengganti, {
                            enableTime: true,
                            noCalendar: true,
                            dateFormat: "H:i",
                            time_24hr: true
                        });
                    });
                },
                closeKelasPenggantiModal() {
                    this.isKelasPenggantiModalOpen = false;
                },
                addNewKelasPengganti(event) {
                    const formData = new FormData(event.target);
                    fetch('tambah_kelas_pengganti.php', {
                            method: 'POST',
                            body: formData
                        })
                        .then(async res => {
                            const raw = await res.text();
                            // console.log('🔥 RAW RESPONSE TAMBAH KELAS PENGGANTI 🔥', raw);
                            let data;
                            try {
                                data = JSON.parse(raw);
                            } catch (e) {
                                // console.error('❌ Gagal parse JSON:', e);
                                this.showNotification('Respons server bukan ga Valid.', 'delete');
                                return;
                            }

                            if (data.status === 'success') {
                                this.showNotification(data.message, 'success');
                                this.isKelasPenggantiModalOpen = false;
                                setTimeout(() => window.location.reload(), 2000);
                            } else {
                                this.showNotification(data.message || 'Gagal menambahkan kelas.', 'delete');
                            }
                        })
                        .catch(err => {
                            // console.error('🔥 DEBUG FETCH ERROR 🔥', err);
                            this.showNotification(`Terjadi error: ${err.message || err}`, 'delete');
                        });
                },
                selesaikanKelas(kelasId) {
                    if (!confirm('Tandai kelas pengganti ini sebagai selesai?')) return;

                    fetch('proses_selesai_kelas.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: `id_kelas_pengganti=${kelasId}`
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                this.showNotification('Kelas berhasil diarsipkan.', 'success');
                                // Reload halaman untuk menghapus kelas dari daftar 'Jadwal Hari Ini'
                                setTimeout(() => window.location.reload(), 1500);
                            } else {
                                this.showNotification(data.message || 'Gagal mengarsipkan kelas.', 'delete');
                            }
                        })
                        .catch(() => this.showNotification('Terjadi kesalahan jaringan.', 'delete'));
                },

                selesaikanKelas(kelasId) {
                    // Fungsi ini sekarang HANYA membuka modal
                    this.kelasToSelesaikanId = kelasId;
                    this.isSelesaikanModalOpen = true;
                },

                executeSelesaikanKelas() {
                    // Fungsi ini yang akan menjalankan fetch
                    if (!this.kelasToSelesaikanId) return;

                    const kelasId = this.kelasToSelesaikanId;

                    // PINDAHKAN logika fetch kamu ke sini
                    fetch('proses_selesai_kelas.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: `id_kelas_pengganti=${kelasId}`
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.status === 'success') {
                                this.showNotification('Kelas berhasil diarsipkan.', 'success');
                                // Reload halaman untuk menghapus kelas dari daftar
                                setTimeout(() => window.location.reload(), 1500);
                            } else {
                                this.showNotification(data.message || 'Gagal mengarsipkan kelas.', 'delete');
                            }
                        })
                        .catch(() => this.showNotification('Terjadi kesalahan jaringan.', 'delete'));

                    // Tutup modal setelah selesai
                    this.closeSelesaikanModal();
                },

                closeSelesaikanModal() {
                    this.isSelesaikanModalOpen = false;
                    this.kelasToSelesaikanId = null;
                },

                isEditModalOpen: false,
                editTaskData: {
                    id: '',
                    nama_tugas: '',
                    deadline: '',
                    jenis: ''
                },

                openEditModal(task) {
                    this.editTaskData = {
                        id: task.id,
                        nama_tugas: task.nama_tugas,
                        deadline: task.deadline,
                        jenis: task.jenis,
                        id_jadwal: task.id_jadwal, // ⬅️ TAMBAHKAN INI
                        nama_matkul: task.nama_matkul, // ⬅️ TAMBAHKAN INI (untuk tampilan dropdown)
                        prioritas: task.prioritas // ⬅️ TAMBAHKAN INI
                    };
                    this.isEditModalOpen = true;
                    this.$nextTick(() => {
                        flatpickr(this.$refs.deadlinePickerEdit, {
                            altInput: true,
                            altFormat: 'F j, Y',
                            dateFormat: 'Y-m-d',
                            defaultDate: this.editTaskData.deadline
                        });
                    });
                },

                closeEditModal() {
                    this.isEditModalOpen = false;
                },

                submitEditTask(event) {
                    // 1. Ambil data dari form yang di-submit
                    const formData = new FormData(event.target);

                    // 2. Panggil skrip PHP edit Anda menggunakan fetch
                    // GANTI 'nama_file_edit_anda.php' dengan nama file PHP yang Anda buat tadi
                    fetch('proses_edit.php', {
                            method: 'POST',
                            body: formData
                        })
                        .then(res => res.json()) // Ubah balasan menjadi JSON
                        .then(data => {
                            // 3. Cek status dari JSON yang dikembalikan PHP
                            if (data.status === 'success') {
                                // Tampilkan notifikasi sukses (ini akan 'nangkep' message dari JSON)
                                this.showNotification(data.message, 'success');
                                // Tutup modal edit
                                this.closeEditModal(); // Asumsi Anda menggunakan modal yang sama
                                // Muat ulang halaman untuk melihat perubahan
                                // Ini cara termudah, sama seperti yg Anda lakukan di 'addNewKelasPengganti'
                                setTimeout(() => window.location.reload(), 1500);

                            } else {
                                // Tampilkan notifikasi error jika PHP mengembalikan 'status: error'
                                this.showNotification(data.message || 'Gagal memperbarui tugas.', 'delete');
                            }
                        })
                        .catch(error => {
                            // Tangani jika ada error jaringan atau JSON tidak valid
                            console.error('Error saat submit edit tugas:', error);
                            this.showNotification('Terjadi kesalahan jaringan saat mengedit.', 'delete');
                        });
                },



                // ... (fungsi Anda yang lain seperti getTaskTypeColor)
            }
        }
    </script>
</head>

<body class="p-4 sm:p-6 lg:p-8 antialiased transition-colors duration-300">

    <!-- Sistem Notifikasi -->
    <div x-data="notificationSystem()"
        x-init="init()"
        x-show="show"
        x-transition:enter="transform ease-out duration-300 transition"
        x-transition:enter-start="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
        x-transition:enter-end="translate-y-0 opacity-100 sm:translate-x-0"
        x-transition:leave="transition ease-in duration-100"
        x-transition:leave-start="opacity-100"
        x-transition:leave-end="opacity-0"
        x-cloak class="fixed top-5 right-5 w-full max-w-sm z-50">
        <div class="glass-card p-4 rounded-lg pointer-events-auto">
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg x-show="type === 'success'" class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <svg x-show="type === 'delete'" class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div class="ml-3 w-0 flex-1 pt-0.5">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100" x-text="message"></p>
                </div>
                <div class="ml-4 flex-shrink-0 flex"><button @click="show = false" class="rounded-md inline-flex text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 focus:outline-none"><span class="sr-only">Close</span><svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg></button></div>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="mb-8 flex justify-between items-center gap-4">
        <div class="min-w-0">
            <h1 class="text-2xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-md truncate">TrackerThings - Hi, <?= $_SESSION['username'] ?>!</h1>
            <p class="text-gray-700 dark:text-gray-300 text-sm sm:text-lg drop-shadow"><?php echo date("l, j F Y"); ?></p>
        </div>
        <div class="flex items-centergap-2 sm:gap-4 flex-shrink-0 md:ml-auto">
            <a href="matakuliah.php" class="hidden md:inline-block glass-button text-gray-800 dark:text-gray-200 px-4 py-2 text-sm font-semibold rounded-full shadow-sm transition-all">Kelola Mata Kuliah</a>
            <a href="ujian.php" class="hidden md:inline-block glass-button text-gray-800 dark:text-gray-200 px-4 py-2 text-sm font-semibold rounded-full shadow-sm transition-all">Kelola Ujian</a>
            <button @click="darkMode = !darkMode" class="glass-button text-gray-800 dark:text-gray-200 p-2 rounded-full hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <svg x-show="!darkMode" x-cloak class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg x-show="darkMode" x-cloak class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
            </button>

            <!-- PERBAIKAN 2: Dropdown Profil Pengguna -->
            <div x-data="{ open: false }" @mouseenter="open = true" @mouseleave="open = false" class="relative">
                <button class="w-10 h-10 rounded-full glass-button flex items-center justify-center overflow-hidden">
                    <?php if (!empty($user_data['profile_picture_url'])): ?>
                        <img src="<?php echo htmlspecialchars($user_data['profile_picture_url']); ?>" alt="Foto Profil" class="w-full h-full object-cover">
                    <?php else: ?>
                        <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                    <?php endif; ?>
                </button>
                <div x-show="open"
                    x-transition:enter="transition ease-out duration-200"
                    x-transition:enter-start="opacity-0 transform -translate-y-2"
                    x-transition:enter-end="opacity-100 transform translate-y-0"
                    x-transition:leave="transition ease-in duration-150"
                    x-transition:leave-start="opacity-100 transform translate-y-0"
                    x-transition:leave-end="opacity-0 transform -translate-y-2"
                    class="absolute right-0 mt-2 w-40 sm:w-48 glass-dropdown-menu rounded-lg shadow-xl z-20" x-cloak>
                    <div class="px-4 py-3 border-b border-black/10 dark:border-white/10">
                        <p class="text-sm text-gray-800 dark:text-gray-200">Masuk sebagai</p>
                        <p class="text-sm font-medium text-gray-900 dark:text-white truncate"><?php echo htmlspecialchars($_SESSION['username']); ?></p>
                    </div>
                    <div class="py-1">
                        <a href="matakuliah.php" class="block md:hidden px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5">Kelola Mata Kuliah</a>
                        <a href="ujian.php" class="block md:hidden px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5">Kelola Ujian</a>
                        <a href="profile.php" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5">Profil Saya</a>
                        <a href="history.php" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5">Riwayat Kelas</a>
                        <a href="ubah_password.php" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5">Pengaturan Akun</a>
                        <a href="logout.php" class="block w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-500/10">Logout</a>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div x-data="{ showNotice: true, progressWidth: '100%' }"
        x-init="
        $nextTick(() => progressWidth = '0%'); 
        setTimeout(() => showNotice = false, 5000)
    "
        x-show="showNotice"
        x-transition:enter="transition ease-out duration-300"
        x-transition:enter-start="opacity-0 transform -translate-y-4"
        x-transition:enter-end="opacity-100 transform translate-y-0"
        x-transition:leave="transition ease-in duration-200"
        x-transition:leave-start="opacity-100 transform translate-y-0"
        x-transition:leave-end="opacity-0 transform -translate-y-4"

        class="relative overflow-hidden mb-6 flex items-start p-4 rounded-2xl 
           bg-amber-500/10 dark:bg-amber-800/20 
           border border-amber-500/20 dark:border-amber-500/30 
           backdrop-blur-lg shadow-md"
        x-cloak>

        <div class="flex-shrink-0">
            <svg class="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <div class="ml-3 flex-1">
            <p class="text-sm text-amber-800 dark:text-amber-200">
                <b>Light Mode</b> masih dalam versi Beta. Silakan beralih ke <b>Dark Mode</b> untuk pengalaman optimal,
                atau <a href="mailto:budinurrahman4@gmail.com?subject=Feedback%20Light%20Mode%20TrackerThings"
                    class="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100">
                    kirim masukan di sini
                </a>.
            </p>
        </div>

        <div class="ml-4 flex-shrink-0">
            <button @click="showNotice = false"
                class="inline-flex rounded-md p-1.5 text-amber-700 dark:text-amber-300 
                   hover:bg-amber-500/20 dark:hover:bg-amber-500/30 
                   focus:outline-none focus:ring-2 focus:ring-amber-600">
                <span class="sr-only">Tutup</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd" />
                </svg>
            </button>
        </div>

        <div class="absolute bottom-0 left-0 h-1 bg-amber-600/70 dark:bg-amber-400/70"
            style="transition: width 5s linear;"
            :style="{ width: progressWidth }">
        </div>
    </div>

    <!-- Navigasi Hari -->
    <nav class="flex flex-wrap gap-2 mb-8">
        <?php foreach ($daftar_hari as $en => $id): ?>
            <a href="?hari=<?php echo $id; ?>" class="px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 <?php echo ($id == $hari_terpilih_indonesia) ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'glass-button text-gray-800 dark:text-gray-200'; ?>"><?php echo $id; ?></a>
        <?php endforeach; ?>
    </nav>

    <!-- Wrapper untuk AlpineJS Task Manager -->
    <div x-data='taskManager(<?php echo json_encode($tugas_belum_selesai); ?>, <?php echo json_encode($tugas_sudah_selesai); ?>)'>

        <!-- Konten Utama -->
        <main class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            <!-- ... Semua card (Jadwal, Ujian, Tugas Mendesak, dll.) ... -->
            <div class="glass-card p-4 sm:p-6 rounded-2xl">
                <div class="flex items-center pb-4 border-b border-black/10 dark:border-white/10 mb-4">
                    <svg class="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341A6.002 6.002 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">Notifikasi Penting</h2>
                </div>

                <ul class="space-y-4 max-h-60 overflow-y-auto pr-2">
                    <?php if (empty($daftar_notifikasi)): ?>
                        <div class="text-center py-8">
                            <svg class="mx-auto h-16 w-16 text-black/10 dark:text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <h3 class="mt-2 text-lg font-semibold text-gray-800 dark:text-gray-100">Semua Aman</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Tidak ada agenda mendesak.</p>
                        </div>
                    <?php else: ?>
                        <?php foreach ($daftar_notifikasi as $item): ?>
                            <?php
                            $tanggal_item = date('Y-m-d', strtotime($item['deadline'] ?? $item['tanggal']));
                            $is_today = ($tanggal_item == date('Y-m-d'));
                            $label = $is_today ? "HARI INI" : "BESOK";
                            $color = $is_today ? "bg-red-500/80 dark:bg-red-500/50 text-white" : "bg-orange-500/80 dark:bg-orange-500/50 text-white";
                            ?>
                            <li class="flex items-start gap-3">
                                <span class="mt-1 flex-shrink-0 px-2.5 py-0.5 text-xs font-bold rounded-md <?php echo $color; ?>"><?php echo $label; ?></span>
                                <div>
                                    <?php if ($item['tipe'] == 'Tugas'): ?>
                                        <h3 class="font-semibold text-gray-800 dark:text-gray-100">Tugas: <?php echo htmlspecialchars($item['nama_tugas']); ?></h3>
                                        <p class="text-sm text-gray-600 dark:text-gray-400"><?php echo htmlspecialchars($item['nama_matkul']); ?></p>
                                    <?php else: // Tipe Ujian 
                                    ?>
                                        <h3 class="font-semibold text-gray-800 dark:text-gray-100">Ujian: <?php echo htmlspecialchars($item['nama_matkul']); ?></h3>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">Dimulai <?php echo $is_today ? 'hari ini' : 'besok'; ?></p>
                                    <?php endif; ?>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </ul>
            </div>
            <!-- Card Jadwal Hari -->
            <div class="glass-card p-4 sm:p-6 rounded-2xl">
                <div class="flex items-center pb-4 border-b border-black/10 dark:border-white/10 mb-4">
                    <svg class="h-6 w-6 text-gray-600 dark:text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">
                        Jadwal Hari <?php echo $hari_terpilih_indonesia; ?>
                    </h2>
                </div>

                <ul class="space-y-4">
                    <?php if (!empty($jadwal_gabungan)): ?>
                        <?php
                        $now = new DateTime(); // waktu sekarang
                        $adaJadwal = false;    // flag untuk cek apakah masih ada jadwal valid

                        foreach ($jadwal_gabungan as $item):
                            $isPengganti = ($item['tipe'] ?? '') === 'pengganti';

                            // Cek apakah jadwal pengganti sudah lewat
                            if ($isPengganti && isset($item['tanggal']) && isset($item['waktu_selesai'])) {
                                $jadwalDateTime = new DateTime($item['tanggal'] . ' ' . $item['waktu_selesai']);
                                if ($jadwalDateTime < $now) {
                                    continue; // skip jadwal pengganti yang sudah lewat
                                }
                            }

                            $adaJadwal = true;
                        ?>
                            <li class="flex items-center justify-between">
                                <div class="flex items-center">
                                    <p class="w-28 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                        <?php echo htmlspecialchars(substr($item['waktu_mulai'], 0, 5) . ' – ' . substr($item['waktu_selesai'], 0, 5)); ?>
                                    </p>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h3 class="font-semibold text-gray-800 dark:text-gray-100">
                                                <?php echo htmlspecialchars($item['nama_matkul']); ?>
                                            </h3>
                                            <?php if ($isPengganti): ?>
                                                <span class="px-2 py-0.5 text-xs font-semibold text-orange-800 bg-orange-200 dark:text-orange-200 dark:bg-orange-800/50 rounded-full">
                                                    PENGGANTI
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">
                                            <?php echo htmlspecialchars($item['kategori'] ?? '') . ' • ' . htmlspecialchars($item['lokasi'] ?? ''); ?>
                                        </p>
                                    </div>
                                </div>

                                <?php if ($isPengganti): ?>
                                    <button
                                        @click="selesaikanKelas(<?php echo $item['id']; ?>)"
                                        title="Tandai Selesai"
                                        class="p-2 rounded-full text-gray-500 dark:text-gray-400 
                                           hover:bg-green-100 dark:hover:bg-green-800/50 
                                           hover:text-green-600 dark:hover:text-green-400 
                                           transition-colors">
                                        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </button>
                                <?php endif; ?>
                            </li>
                        <?php endforeach; ?>

                        <?php if (!$adaJadwal): ?>
                            <div class="text-center py-8">
                                <svg class="mx-auto h-24 w-24 text-black/10 dark:text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <h3 class="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Jadwal Kosong</h3>
                                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Nikmati waktu luangmu!</p>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <div class="text-center py-8">
                            <svg class="mx-auto h-24 w-24 text-black/10 dark:text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <h3 class="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Jadwal Kosong</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Nikmati waktu luangmu!</p>
                        </div>
                    <?php endif; ?>
                </ul>
            </div>

            <!-- Card Ujian Terdekat -->
            <div class="glass-card p-4 sm:p-6 rounded-2xl w-full">
                <!-- ... -->
                <div class="flex items-center pb-4 border-b border-black/10 dark:border-white/10 mb-4"><svg class="h-6 w-6 text-yellow-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10m-12 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14"></path>
                    </svg>
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">Ujian Terdekat</h2>
                </div>
                <?php if ($ujian_terdekat): ?>
                    <div class="space-y-3">
                        <div class="flex items-center gap-2"><span class="px-2 py-1 text-xs font-bold leading-none text-white rounded-md <?php echo ($ujian_terdekat['jenis_ujian'] == 'UTS') ? 'bg-orange-500' : (($ujian_terdekat['jenis_ujian'] == 'UAS') ? 'bg-red-500' : 'bg-blue-500'); ?>"><?php echo htmlspecialchars($ujian_terdekat['jenis_ujian']); ?></span>
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100"><?php echo htmlspecialchars($ujian_terdekat['nama_matkul']); ?></h3>
                        </div>
                        <p class="text-gray-600 dark:text-gray-300"><strong class="text-gray-700 dark:text-gray-200">Jadwal:</strong> <?php echo date('l, d F Y', strtotime($ujian_terdekat['tanggal'])); ?></p>
                        <p class="text-gray-600 dark:text-gray-300"><strong class="text-gray-700 dark:text-gray-200">Waktu:</strong> <?php echo substr($ujian_terdekat['waktu_mulai'], 0, 5); ?> - <?php echo substr($ujian_terdekat['waktu_selesai'], 0, 5); ?></p>
                        <p class="text-gray-600 dark:text-gray-300"><strong class="text-gray-700 dark:text-gray-200">Ruangan:</strong> <?php echo htmlspecialchars($ujian_terdekat['ruangan'] ?: 'Belum ditentukan'); ?></p><?php if (!empty($ujian_terdekat['catatan'])): ?><div class="pt-2 border-t border-black/10 dark:border-white/10">
                                <p class="text-sm text-gray-600 dark:text-gray-300"><strong class="text-gray-700 dark:text-gray-200">Catatan:</strong> <?php echo htmlspecialchars($ujian_terdekat['catatan']); ?></p>
                            </div><?php endif; ?>
                    </div>
                <?php else: ?>
                    <div class="text-center py-8"><svg class="mx-auto h-16 w-16 text-black/10 dark:text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10m-12 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14"></path>
                        </svg>
                        <h3 class="mt-2 text-lg font-semibold text-gray-800 dark:text-gray-100">Tidak Ada Ujian</h3>
                        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Belum ada jadwal ujian mendatang.</p>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Card Tugas Mendesak -->
            <div class="glass-card p-4 sm:p-6 rounded-2xl">
                <!-- ... -->
                <div class="flex items-center pb-4 border-b border-black/10 dark:border-white/10 mb-4"><svg class="h-6 w-6 text-gray-600 dark:text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z"></path>
                    </svg>
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">Tugas Mendesak</h2>
                </div>
                <ul class="space-y-5">
                    <template x-for="task in urgentTasks" :key="task.id">
                        <li class="flex items-start justify-between">
                            <div class="flex-1 pr-4">
                                <div class="flex items-center gap-2"><span class="px-2 py-1 text-xs font-bold leading-none text-white rounded-md" :class="getTaskTypeColor(task.jenis)" x-text="task.jenis"></span>
                                    <h3 class="font-semibold text-gray-800 dark:text-gray-100" x-text="task.nama_tugas"></h3>
                                </div>
                                <div class="flex items-center gap-2 mt-1">
                                    <div class="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5">
                                        <div class="bg-blue-500 h-1.5 rounded-full" :style="`width: ${task.progress}%`"></div>
                                    </div><span class="text-xs font-medium text-gray-600 dark:text-gray-300" x-text="`${task.progress}%`"></span>
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-400 mt-2"><span x-text="task.nama_matkul"></span> • <span class="font-semibold px-2 py-1 rounded-full text-xs" :class="getDeadlineInfo(task.deadline).color" x-text="getDeadlineInfo(task.deadline).text"></span></div>
                            </div>
                            <div class="flex items-center gap-2">
                                <div x-data="{ open: false }" class="relative">
                                    <button @click="open = !open" class="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" title="Ubah Progress"><svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                                        </svg></button>
                                    <div x-show="open" @click.away="open = false" x-cloak="" x-transition="" class="absolute right-0 top-8 w-28 glass-card rounded-lg z-10 p-1" style="display: none;">
                                        <a @click="updateProgress(task.id, 0); open = false" class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">0%</a>
                                        <a @click="updateProgress(task.id, 25); open = false" class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">25%</a>
                                        <a @click="updateProgress(task.id, 50); open = false" class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">50%</a>
                                        <a @click="updateProgress(task.id, 75); open = false" class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 rounded-md hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">75%</a>
                                        <a @click="updateProgress(task.id, 100); open = false" class="block w-full text-left px-3 py-1.5 text-sm text-green-600 dark:text-green-400 rounded-md hover:bg-green-500/20 font-semibold cursor-pointer">100%</a>
                                    </div>
                                </div>
                                <button
                                    @click="openEditModal(task)" type="button"
                                    class="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                    title="Edit Tugas">
                                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path>
                                        <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path>
                                    </svg>
                                </button>
                                <button @click="deleteTask(task.id)" type="button" class="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Hapus Tugas"><svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg></button>
                            </div>
                        </li>
                    </template>
                    <template x-if="urgentTasks.length === 0">
                        <div class="text-center py-8">
                            <svg class="mx-auto h-24 w-24 text-black/10 dark:text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <h3 class="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Semua Tugas Selesai</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Kerja bagus! Tidak ada tugas mendesak.</p>
                        </div>
                    </template>
                </ul>
            </div>

            <!-- Tombol Pemicu Modal -->
            <div class="flex items-center justify-center glass-card p-8 rounded-3xl w-full min-h-[200px]">
                <button @click="openModal()" class="text-center group">
                    <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                        <svg class="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                    </div>
                    <h3 class="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Tambah Tugas Baru</h3>
                </button>
            </div>

            <!-- Tombol Pemicu Modal Kelas Pengganti -->
            <div class="flex items-center justify-center glass-card p-8 rounded-3xl w-full min-h-[200px]">
                <button @click="openKelasPenggantiModal()" class="text-center group">
                    <div class="w-16 h-16 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center mx-auto group-hover:bg-orange-200 dark:group-hover:bg-orange-800/50 transition-colors">
                        <svg class="h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </div>
                    <h3 class="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Tambah Kelas Pengganti</h3>
                </button>
            </div>

            <!-- Card Tugas Selesai -->
            <div class="glass-card p-4 sm:p-6 rounded-2xl lg:col-span-2 xl:col-span-3">
                <!-- ... -->
                <div class="flex items-center pb-4 border-b border-black/10 dark:border-white/10 mb-4"><svg class="h-6 w-6 text-gray-600 dark:text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h2 class="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">Tugas Selesai</h2>
                </div>
                <ul class="space-y-3">
                    <template x-for="task in completedTasks" :key="task.id">
                        <li class="flex items-center text-gray-600 dark:text-gray-400 opacity-75">
                            <svg class="h-5 w-5 text-green-500 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                            </svg>
                            <span class="line-through" x-text="task.nama_tugas"></span>
                            <span class="ml-auto text-xs font-medium text-gray-500 dark:text-gray-500 pl-4" x-text="task.nama_matkul"></span>
                        </li>
                    </template>
                    <template x-if="completedTasks.length === 0">
                        <p class="text-gray-600 dark:text-gray-400">Belum ada tugas yang selesai. Semangat!</p>
                    </template>
                </ul>
            </div>
        </main>

        <!-- Modal Tambah Tugas -->
        <div x-show="isModalOpen" x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50" x-cloak>
            <div @click.away="closeModal()" class="glass-card p-6 sm:p-8 rounded-3xl w-full max-w-xl mx-4" x-show="isModalOpen" x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100" x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95">
                <div class="flex items-center justify-between pb-6 border-b border-black/10 dark:border-white/10 mb-6">
                    <div class="flex items-center gap-3">
                        <svg class="h-7 w-7 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Tambah Tugas Baru</h2>
                    </div>
                    <button @click="closeModal()" class="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <form @submit.prevent="addNewTask($event)" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="col-span-1 md:col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Tugas</label><input type="text" name="nama_tugas" required class="glass-input w-full rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition"></div>
                    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label><input x-ref="deadlinePickerModal" type="text" name="deadline" placeholder="Pilih tanggal" required class="glass-input w-full rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition"></div>
                    <div x-data="{ open: false, selectedId: '', selectedName: '-- Pilih Mata Kuliah --' }" class="relative"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Kuliah</label><input type="hidden" name="id_jadwal" x-model="selectedId" required><button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-2xl px-4 py-3 text-left focus:ring-2 focus:ring-blue-400 focus:outline-none flex justify-between items-center"><span x-text="selectedName" class="truncate"></span><svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                            </svg></button>
                        <div x-show="open" @click.away="open = false" x-cloak class="absolute z-20 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto"><?php mysqli_data_seek($result_semua_matkul, 0);
                                                                                                                                                                        while ($matkul = $result_semua_matkul->fetch_assoc()): ?><a @click="selectedId = <?php echo $matkul['id']; ?>; selectedName = '<?php echo htmlspecialchars(addslashes($matkul['nama_matkul'])); ?>'; open = false;" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"><?php echo htmlspecialchars($matkul['nama_matkul']); ?></a><?php endwhile; ?></div>
                    </div>
                    <div x-data="{ open: false, selectedValue: 'Tugas' }" class="relative"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Penugasan</label><input type="hidden" name="jenis" x-model="selectedValue"><button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-2xl px-4 py-3 text-left flex justify-between items-center focus:ring-2 focus:ring-blue-400 focus:outline-none"><span x-text="selectedValue"></span><svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                            </svg></button>
                        <div x-show="open" @click.away="open = false" x-cloak class="absolute z-20 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto"><template x-for="item in ['Tugas','Quiz','Project','UTS','UAS']" :key="item"><a @click="selectedValue = item; open = false" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" x-text="item"></a></template></div>
                    </div>
                    <div x-data="{ open: false, selectedValue: 'Rendah 🟢' }" class="relative"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas</label><input type="hidden" name="prioritas" x-model="selectedValue"><button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-2xl px-4 py-3 text-left flex justify-between items-center focus:ring-2 focus:ring-blue-400 focus:outline-none"><span x-text="selectedValue"></span><svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                            </svg></button>
                        <div x-show="open" @click.away="open = false" x-cloak class="absolute z-20 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto"><template x-for="item in ['Rendah 🟢', 'Sedang 🟠', 'Tinggi 🔴']" :key="item"><a @click="selectedValue = item; open = false" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer" x-text="item"></a></template></div>
                    </div>
                    <div class="col-span-1 md:col-span-2"><button type="submit" class="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 active:scale-[0.98]">Simpan Tugas</button></div>
                </form>
            </div>
        </div>

        <!-- Modal Tambah Kelas Pengganti -->
        <div x-show="isKelasPenggantiModalOpen" x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50" x-cloak>
            <div @click.away="closeKelasPenggantiModal()" class="glass-card p-6 sm:p-8 rounded-3xl w-full max-w-xl mx-4">
                <div class="flex items-center justify-between pb-6 border-b border-black/10 dark:border-white/10 mb-6">
                    <div class="flex items-center gap-3">
                        <svg class="h-7 w-7 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 tracking-tight">Tambah Kelas Pengganti</h2>
                    </div>
                    <button @click="closeKelasPenggantiModal()" class="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <form @submit.prevent="addNewKelasPengganti($event)" class="space-y-4">
                    <div x-data="{ open: false, selectedId: '', selectedName: '-- Pilih Mata Kuliah --' }" class="relative">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Kuliah</label>
                        <input type="hidden" name="id_jadwal" x-model="selectedId" required>
                        <button type="button" @click="open = !open" class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left focus:ring-2 focus:ring-blue-400 focus:outline-none flex justify-between items-center"><span x-text="selectedName" class="truncate"></span><svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z" clip-rule="evenodd" />
                            </svg></button>
                        <div x-show="open" @click.away="open = false" x-cloak class="absolute z-20 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto"><?php mysqli_data_seek($result_semua_matkul, 0);
                                                                                                                                                                        while ($matkul = $result_semua_matkul->fetch_assoc()): ?><a @click="selectedId = <?php echo $matkul['id']; ?>; selectedName = '<?php echo htmlspecialchars(addslashes($matkul['nama_matkul'])); ?>'; open = false;" class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"><?php echo htmlspecialchars($matkul['nama_matkul']); ?></a><?php endwhile; ?></div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                        <input x-ref="tanggalPengganti" type="text" name="tanggal" placeholder="Pilih tanggal" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Waktu Mulai</label>
                            <input x-ref="waktuMulaiPengganti" type="text" name="waktu_mulai" placeholder="00:00" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Waktu Selesai</label>
                            <input x-ref="waktuSelesaiPengganti" type="text" name="waktu_selesai" placeholder="00:00" required class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lokasi (Opsional)</label>
                        <input type="text" name="lokasi" placeholder="Contoh: Ruang G.1.1" class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan (Opsional)</label>
                        <textarea name="catatan" rows="2" placeholder="Contoh: Membahas materi bab 5" class="glass-input w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none"></textarea>
                    </div>
                    <div class="pt-4"><button type="submit" class="w-full bg-orange-600 text-white font-semibold py-3 rounded-lg hover:bg-orange-700 transition-all">Simpan Kelas Pengganti</button></div>
                </form>
            </div>
        </div>

        <!-- 🧱 Modal Edit Tugas -->
        <div
            x-show="isEditModalOpen"
            x-cloak
            class="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">

            <div class="glass-card p-6 sm:p-8 rounded-2xl w-full max-w-lg shadow-xl relative">
                <!-- Tombol Tutup -->
                <button @click="closeEditModal()"
                    class="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    ✖
                </button>

                <div class="flex items-center gap-3 pb-4 border-b border-black/10 dark:border-white/10 mb-6">
                    <svg class="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-200 tracking-tight">Edit Tugas</h1>
                </div>

                <!-- 🧾 Form Edit -->
                <form @submit.prevent="submitEditTask($event)" class="space-y-6">
                    <input type="hidden" name="id_tugas" x-model="editTaskData.id">

                    <!-- Nama Tugas -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Tugas</label>
                        <input type="text" name="nama_tugas" x-model="editTaskData.nama_tugas" required
                            class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
                    </div>

                    <!-- Deadline -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deadline</label>
                        <input x-ref="deadlinePickerEdit" type="text" name="deadline" x-model="editTaskData.deadline"
                            placeholder="Pilih tanggal" required
                            class="glass-input mt-1 block w-full rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-400 focus:outline-none transition">
                    </div>

                    <!-- Dropdown Mata Kuliah -->
                    <div x-data="{ open: false }" class="relative">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Kuliah</label>
                        <input type="hidden" name="id_jadwal" x-model="editTaskData.id_jadwal">
                        <button type="button" @click="open = !open"
                            class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left focus:ring-2 focus:ring-blue-400 flex justify-between items-center mt-1">
                            <span x-text="editTaskData.nama_matkul || 'Pilih Mata Kuliah'"></span>
                            <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div x-show="open" @click.away="open = false" x-cloak
                            class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                            <!-- Loop dari PHP -->
                            <?php foreach ($semua_matkul_arr as $matkul): ?>
                                <a @click="editTaskData.id_jadwal = <?php echo $matkul['id']; ?>; editTaskData.nama_matkul = '<?php echo htmlspecialchars(addslashes($matkul['nama_matkul'])); ?>'; open = false;"
                                    class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer">
                                    <?php echo htmlspecialchars($matkul['nama_matkul']); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <!-- Jenis Penugasan -->
                    <div x-data="{ open: false }" class="relative">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Penugasan</label>
                        <input type="hidden" name="jenis" x-model="editTaskData.jenis">
                        <button type="button" @click="open = !open"
                            class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left flex justify-between items-center mt-1">
                            <span x-text="editTaskData.jenis || 'Pilih Jenis'"></span>
                            <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div x-show="open" @click.away="open = false" x-cloak
                            class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                            <template x-for="item in ['Tugas', 'Quiz', 'Project', 'UTS', 'UAS']" :key="item">
                                <a @click="editTaskData.jenis = item; open = false;"
                                    class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                                    x-text="item"></a>
                            </template>
                        </div>
                    </div>

                    <!-- Prioritas -->
                    <div x-data="{ open: false }" class="relative">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioritas</label>
                        <input type="hidden" name="prioritas" x-model="editTaskData.prioritas">
                        <button type="button" @click="open = !open"
                            class="glass-dropdown-button w-full rounded-lg px-4 py-3 text-left flex justify-between items-center mt-1">
                            <span x-text="editTaskData.prioritas || 'Pilih Prioritas'"></span>
                            <svg class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div x-show="open" @click.away="open = false" x-cloak
                            class="absolute z-10 mt-2 w-full glass-dropdown-menu rounded-2xl max-h-56 overflow-auto">
                            <template x-for="item in ['Rendah 🟢', 'Sedang 🟠', 'Tinggi 🔴']" :key="item">
                                <a @click="editTaskData.prioritas = item; open = false;"
                                    class="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                                    x-text="item"></a>
                            </template>
                        </div>
                    </div>

                    <!-- Tombol Aksi -->
                    <div class="flex items-center gap-4 pt-4">
                        <button type="submit"
                            class="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 shadow-lg transition-all">
                            Simpan Perubahan
                        </button>
                        <button type="button" @click="closeEditModal()"
                            class="w-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-all">
                            Batal
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div x-show="isDeleteModalOpen"
            x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
            x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0"
            class="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
            x-cloak>

            <div @click.away="closeDeleteModal()" class="glass-card p-6 sm:p-8 rounded-3xl w-full max-w-md mx-4"
                x-show="isDeleteModalOpen"
                x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100"
                x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95">

                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>

                    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Konfirmasi Hapus</h2>

                    <p class="text-gray-600 dark:text-gray-300 mb-8">
                        Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan.
                    </p>

                    <div class="flex items-center justify-center gap-4 w-full">
                        <button @click="closeDeleteModal()" type="button" class="w-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-all">
                            Batal
                        </button>
                        <button @click="executeDelete()" type="button" class="w-full bg-red-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-500/50 shadow-lg shadow-red-500/30 dark:shadow-red-800/30 transition-all">
                            Ya, Hapus
                        </button>
                    </div>
                </div>

            </div>
        </div>
        <div x-show="isSelesaikanModalOpen"
            x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
            x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0"
            class="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
            x-cloak>

            <div @click.away="closeSelesaikanModal()" class="glass-card p-6 sm:p-8 rounded-3xl w-full max-w-md mx-4"
                x-show="isSelesaikanModalOpen"
                x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0 scale-95" x-transition:enter-end="opacity-100 scale-100"
                x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100 scale-100" x-transition:leave-end="opacity-0 scale-95">

                <div class="flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center mx-auto mb-4">
                        <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>

                    <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Konfirmasi Selesai</h2>

                    <p class="text-gray-600 dark:text-gray-300 mb-8">
                        Apakah Anda yakin ingin menandai kelas pengganti ini sebagai selesai dan mengarsipkannya?
                    </p>

                    <div class="flex items-center justify-center gap-4 w-full">
                        <button @click="closeSelesaikanModal()" type="button" class="w-full bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold py-3 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-all">
                            Batal
                        </button>
                        <button @click="executeSelesaikanKelas()" type="button" class="w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-500/50 shadow-lg shadow-green-500/30 dark:shadow-green-800/30 transition-all">
                            Ya, Selesaikan
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </div>
</body>

</html>