<?php
// --- PERBAIKAN 1: Memulai session and dan validasi login ---
session_start();

header('Content-Type: application/json');
require_once 'koneksi.php';

// Cek apakah user sudah login, jika tidak kirim respons error
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Akses ditolak. Silakan login terlebih dahulu.'
    ]);
    exit;
}

// Ambil user_id yang aman dari session
$user_id = $_SESSION['user_id'];

$id_tugas = $_POST['id_tugas'] ?? null;
$progress = $_POST['progress'] ?? null;

if (!$id_tugas || $progress === null) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Data tidak lengkap'
    ]);
    exit;
}

// Logika status yang lebih baik
$progress = (int)$progress; // Pastikan progress adalah integer
if ($progress >= 100) {
    $status = 'Selesai';
    $progress = 100; // Pastikan tidak lebih dari 100
} elseif ($progress > 0) {
    $status = 'Sedang Dikerjakan';
} else {
    $status = 'Belum Dikerjakan';
    $progress = 0; // Pastikan tidak kurang dari 0
}

// --- PERBAIKAN 2: Tambahkan "AND user_id = ?" pada query UPDATE ---
$stmt = $conn->prepare("UPDATE tugas SET progress = ?, status = ? WHERE id = ? AND user_id = ?");
if (!$stmt) {
    echo json_encode(['status' => 'error', 'message' => 'Gagal menyiapkan statement: ' . $conn->error]);
    exit();
}

// --- PERBAIKAN 3: Sesuaikan bind_param untuk menyertakan user_id ---
$stmt->bind_param("isii", $progress, $status, $id_tugas, $user_id);

if ($stmt->execute()) {
    // Cek apakah ada baris yang benar-benar terpengaruh (berhasil diupdate)
    if ($stmt->affected_rows > 0) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Progress berhasil diperbarui'
        ]);
    } else {
        // Ini terjadi jika ID tugas tidak ditemukan atau bukan milik user
        echo json_encode([
            'status' => 'error',
            'message' => 'Gagal memperbarui: Tugas tidak ditemukan atau Anda tidak memiliki izin.'
        ]);
    }
} else {
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal update progress: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
