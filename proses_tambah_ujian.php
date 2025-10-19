<?php
// --- PERBAIKAN 1: Memulai session dan mengamankan halaman ---
session_start();

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

// Ambil user_id yang aman dari session
$user_id = $_SESSION['user_id'];

require_once 'koneksi.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil semua data dari form
    $id_jadwal     = $_POST['id_jadwal'];
    $jenis_ujian   = $_POST['jenis_ujian'];
    $tanggal       = $_POST['tanggal'];
    $waktu_mulai   = $_POST['waktu_mulai'] ?: NULL;
    $waktu_selesai = $_POST['waktu_selesai'] ?: NULL;
    $ruangan       = $_POST['ruangan'];
    $catatan       = $_POST['catatan'];

    // --- PERBAIKAN 2: Tambahkan kolom dan parameter user_id di query INSERT ---
    $stmt = $conn->prepare("INSERT INTO ujian (id_jadwal, jenis_ujian, tanggal, waktu_mulai, waktu_selesai, ruangan, catatan, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) {
        die("Prepare failed: (" . $conn->errno . ") " . $conn->error);
    }

    // --- PERBAIKAN 3: Sesuaikan bind_param untuk menyertakan user_id ---
    $stmt->bind_param(
        "issssssi",
        $id_jadwal,
        $jenis_ujian,
        $tanggal,
        $waktu_mulai,
        $waktu_selesai,
        $ruangan,
        $catatan,
        $user_id // <-- Diambil dari session, aman!
    );

    if ($stmt->execute()) {
        header("Location: ujian.php?status=sukses_tambah");
        exit();
    } else {
        echo "Error: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
}
