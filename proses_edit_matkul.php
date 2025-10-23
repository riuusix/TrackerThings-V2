<?php
require_once 'koneksi.php';
// session_start();
require_once 'security_helpers.php';

// 1️⃣ Cek login user
$user_id = require_login();

// 2️⃣ Validasi metode HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $_SESSION['error_reason'] = 'invalid_method';
    header("Location: error.php");
    exit();
}

// 3️⃣ Validasi input
$id = validate_numeric($_POST['id'] ?? null);

// Sanitasi string (hindari XSS)
function clean($value)
{
    return htmlspecialchars(trim($value ?? ''), ENT_QUOTES, 'UTF-8');
}

$nama_matkul   = clean($_POST['nama_matkul']);
$dosen         = clean($_POST['dosen']);
$kategori      = clean($_POST['kategori']);
$hari          = clean($_POST['hari']);
$waktu_mulai   = clean($_POST['waktu_mulai']);
$waktu_selesai = clean($_POST['waktu_selesai']);
$lokasi        = clean($_POST['lokasi']);

if ($nama_matkul === '') {
    $_SESSION['error_reason'] = 'invalid_input';
    header("Location: error.php");
    exit();
}

// 4️⃣ Cek kepemilikan
check_ownership($conn, 'jadwal', $id, $user_id);

// 5️⃣ Update data
$stmt = $conn->prepare("
    UPDATE jadwal 
    SET nama_matkul = ?, dosen = ?, kategori = ?, hari = ?, waktu_mulai = ?, waktu_selesai = ?, lokasi = ?
    WHERE id = ? AND user_id = ?
");
$stmt->bind_param(
    "sssssssii",
    $nama_matkul,
    $dosen,
    $kategori,
    $hari,
    $waktu_mulai,
    $waktu_selesai,
    $lokasi,
    $id,
    $user_id
);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        // ✅ Sukses edit
        header("Location: matakuliah.php?status=sukses_edit");
        exit();
    } else {
        // ❌ Tidak ada perubahan data
        $_SESSION['error_reason'] = 'no_change';
        header("Location: error.php");
        exit();
    }
} else {
    $_SESSION['error_reason'] = 'server_error';
    header("Location: error.php");
    exit();
}

$stmt->close();
$conn->close();
exit();
