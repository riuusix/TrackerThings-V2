<?php
// --- PENTING: Untuk menampilkan semua error jika terjadi ---
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

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
