<?php
// session_start();
require_once 'koneksi.php';
require_once 'security_helpers.php'; // 👈 pakai helper biar konsisten

// 1️⃣ Cek login
$user_id = require_login();

// 2️⃣ Validasi metode request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $_SESSION['error_reason'] = 'invalid_method';
    header("Location: error.php");
    exit();
}

// 3️⃣ Ambil & sanitasi data
$nama_matkul   = htmlspecialchars(trim($_POST['nama_matkul'] ?? ''), ENT_QUOTES, 'UTF-8');
$dosen         = htmlspecialchars(trim($_POST['dosen'] ?? ''), ENT_QUOTES, 'UTF-8');
$kategori      = htmlspecialchars(trim($_POST['kategori'] ?? ''), ENT_QUOTES, 'UTF-8');
$lokasi        = htmlspecialchars(trim($_POST['lokasi'] ?? ''), ENT_QUOTES, 'UTF-8');
$hari          = htmlspecialchars(trim($_POST['hari'] ?? ''), ENT_QUOTES, 'UTF-8');
$waktu_mulai   = htmlspecialchars(trim($_POST['waktu_mulai'] ?? ''), ENT_QUOTES, 'UTF-8');
$waktu_selesai = htmlspecialchars(trim($_POST['waktu_selesai'] ?? ''), ENT_QUOTES, 'UTF-8');

// 4️⃣ Validasi field wajib
if ($nama_matkul === '') {
    $_SESSION['error_reason'] = 'invalid_input';
    header("Location: error.php");
    exit();
}

// 5️⃣ Insert data dengan prepared statement
$stmt = $conn->prepare("
    INSERT INTO jadwal (nama_matkul, dosen, kategori, lokasi, hari, waktu_mulai, waktu_selesai, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");
if (!$stmt) {
    $_SESSION['error_reason'] = 'server_error';
    header("Location: error.php");
    exit();
}

$stmt->bind_param(
    "sssssssi",
    $nama_matkul,
    $dosen,
    $kategori,
    $lokasi,
    $hari,
    $waktu_mulai,
    $waktu_selesai,
    $user_id
);

if ($stmt->execute()) {
    header("Location: matakuliah.php?status=sukses_tambah");
    exit();
} else {
    $_SESSION['error_reason'] = 'server_error';
    header("Location: error.php");
    exit();
}

$stmt->close();
$conn->close();
exit();
