<?php
session_set_cookie_params([
    'lifetime' => 0, // hilang kalau browser ditutup
    'path' => '/',
    'secure' => isset($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Lax'
]);
// Set session timeout ke 15 menit (15 * 60 detik)
ini_set('session.gc_maxlifetime', 900);

// Biarkan cookie lifetime 0 (session hilang saat browser ditutup)
ini_set('session.cookie_lifetime', 0);

// Baru jalankan session_start() (jika belum ada di file lain)
// Jika session_start() sudah ada di awal setiap file (seperti index.php),
// baris session_start() di sini bisa dihapus/dikomentari.
// Yang penting ini_set() dijalankan SEBELUM session_start() manapun.
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

$timeout = 900; // 30 menit

if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $timeout)) {
    session_unset();
    session_destroy();
    header("Location: login.php?timeout=1");
    exit;
}

$_SESSION['last_activity'] = time();


// koneksi.example.php
$host = 'localhost'; // atau 127.0.0.1
$user = 'jadwal_user';
$pass = 'PasswordKuat123!';
$db_name = 'db_jadwalku';


// Membuat koneksi
$conn = new mysqli($host, $user, $pass, $db_name);

// Cek koneksi
if ($conn->connect_error) {
    // Menghentikan skrip dan menampilkan pesan error yang jelas
    die("Koneksi ke database gagal: " . $conn->connect_error);
}

// --- TAMBAHAN PENTING ---
// Mengatur character set ke utf8mb4 untuk mendukung semua jenis karakter
if (!mysqli_set_charset($conn, "utf8mb4")) {
    die("Error saat memuat character set utf8mb4: " . mysqli_error($conn));
}
