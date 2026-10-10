<?php
// --- PERBAIKAN 1: Memulai session dan mengamankan halaman ---
require_once 'koneksi.php';

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

// Ambil user_id dari session untuk keamanan
$user_id = $_SESSION['user_id'];


if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil semua data dari form
    $id            = $_POST['id'];
    $id_jadwal     = $_POST['id_jadwal'];
    $jenis_ujian   = $_POST['jenis_ujian'];
    $tanggal       = $_POST['tanggal'];
    $waktu_mulai   = $_POST['waktu_mulai'] ?: NULL;
    $waktu_selesai = $_POST['waktu_selesai'] ?: NULL;
    $ruangan       = $_POST['ruangan'];
    $catatan       = $_POST['catatan'];

    // --- PERBAIKAN 2: Tambahkan "AND user_id = ?" pada query UPDATE ---
    // Ini memastikan pengguna hanya bisa mengedit data miliknya sendiri.
    $stmt = $conn->prepare("UPDATE ujian 
                            SET id_jadwal = ?, jenis_ujian = ?, tanggal = ?, waktu_mulai = ?, waktu_selesai = ?, ruangan = ?, catatan = ?
                            WHERE id = ? AND user_id = ?");
    if (!$stmt) {
        die("Prepare failed: (" . $conn->errno . ") " . $conn->error);
    }

    // --- PERBAIKAN 3: Sesuaikan bind_param (issssssi -> issssssii) ---
    $stmt->bind_param(
        "issssssii",
        $id_jadwal,
        $jenis_ujian,
        $tanggal,
        $waktu_mulai,
        $waktu_selesai,
        $ruangan,
        $catatan,
        $id,
        $user_id // <-- Variabel user_id dari session diikatkan di sini
    );

    if ($stmt->execute()) {
        header("Location: ujian.php?status=sukses_edit");
        exit();
    } else {
        echo "Error: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
}
