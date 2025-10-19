<?php
// --- PERBAIKAN 1: Memulai session dan mengamankan halaman ---
session_start();

// Jika user belum login, tendang ke halaman login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

// Ambil user_id dari session untuk keamanan
$user_id = $_SESSION['user_id'];

require_once 'koneksi.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil semua data dari form
    $id_tugas   = $_POST['id_tugas'];
    $nama_tugas = $_POST['nama_tugas'];
    $deadline   = $_POST['deadline'];
    $id_jadwal  = $_POST['id_jadwal'];
    $prioritas  = $_POST['prioritas'];
    $jenis      = $_POST['jenis'];

    // --- PERBAIKAN 2: Tambahkan "AND user_id = ?" pada query UPDATE ---
    // Ini memastikan pengguna hanya bisa mengedit data miliknya sendiri.
    $stmt = $conn->prepare("UPDATE tugas 
                            SET nama_tugas = ?, deadline = ?, id_jadwal = ?, prioritas = ?, jenis = ? 
                            WHERE id = ? AND user_id = ?");
    if (!$stmt) {
        die("Prepare failed: (" . $conn->errno . ") " . $conn->error);
    }

    // --- PERBAIKAN 3: Sesuaikan bind_param (ssissi -> ssissii) ---
    $stmt->bind_param(
        "ssissii",
        $nama_tugas,
        $deadline,
        $id_jadwal,
        $prioritas,
        $jenis,
        $id_tugas,
        $user_id // <-- Variabel user_id dari session diikatkan di sini
    );

    // Eksekusi statement
    if ($stmt->execute()) {
        header("Location: index.php?edit=sukses");
        exit();
    } else {
        echo "Error: " . $stmt->error;
    }

    $stmt->close();
    $conn->close();
}
