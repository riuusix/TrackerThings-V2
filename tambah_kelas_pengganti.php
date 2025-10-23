<?php
session_start();
require_once 'koneksi.php';
require_once 'security_helpers.php';

header('Content-Type: application/json');

// ✅ 1. Pastikan user login
$user_id = require_login(true); // mode JSON respons

// ✅ 2. Ambil & validasi input
$id_jadwal = validate_numeric($_POST['id_jadwal'] ?? null, true);
$tanggal = trim($_POST['tanggal'] ?? '');
$waktu_mulai = trim($_POST['waktu_mulai'] ?? '');
$waktu_selesai = trim($_POST['waktu_selesai'] ?? '');
$lokasi = trim($_POST['lokasi'] ?? '');
$catatan = trim($_POST['catatan'] ?? '');

// ✅ 3. Cek apakah jadwal ada dan milik user yang login
check_existence($conn, 'jadwal', $id_jadwal, true);
check_ownership($conn, 'jadwal', $id_jadwal, $user_id, 'user_id', true);

// ✅ 4. Validasi field wajib
if (empty($tanggal) || empty($waktu_mulai) || empty($waktu_selesai)) {
    json_error('missing_fields', 'Tanggal, waktu mulai, dan waktu selesai wajib diisi.');
}

// ✅ 5. Validasi format waktu & tanggal (opsional tapi bagus)
$waktu_regex = '/^(?:2[0-3]|[01][0-9]):[0-5][0-9]$/';
$tanggal_regex = '/^\d{4}-\d{2}-\d{2}$/';

if (!preg_match($tanggal_regex, $tanggal)) {
    json_error('invalid_date', 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.');
}
if (!preg_match($waktu_regex, $waktu_mulai) || !preg_match($waktu_regex, $waktu_selesai)) {
    json_error('invalid_time', 'Format waktu tidak valid. Gunakan HH:MM (24 jam).');
}

// ✅ 6. Masukkan ke database
$stmt = $conn->prepare("
    INSERT INTO kelas_pengganti 
    (user_id, id_jadwal, tanggal, waktu_mulai, waktu_selesai, lokasi, catatan) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
");

if (!$stmt) {
    json_error('server_error', 'Gagal mempersiapkan query: ' . $conn->error);
}

$stmt->bind_param(
    "iisssss",
    $user_id,
    $id_jadwal,
    $tanggal,
    $waktu_mulai,
    $waktu_selesai,
    $lokasi,
    $catatan
);

if ($stmt->execute()) {
    echo json_encode([
        'status' => 'success',
        'message' => '✅ Kelas pengganti berhasil ditambahkan!'
    ]);
} else {
    json_error('server_error', 'Gagal menyimpan ke database: ' . $stmt->error);
}

$stmt->close();
$conn->close();
