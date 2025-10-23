<?php
// --- 1. Memulai session dan validasi ---
// session_start();
require_once 'koneksi.php';

// Cek jika user belum login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

$user_id = $_SESSION['user_id'];
$redirect_page = 'ubah_password.php'; // Ganti ke 'akun.php' jika kamu sudah rename

// Hanya izinkan metode POST
if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    $_SESSION['error'] = 'Metode tidak diizinkan.';
    header("Location: $redirect_page");
    exit();
}

// --- 2. Ambil dan Validasi Input Form ---
$security_prompt = $_POST['security_prompt'] ?? '';
$security_answer = $_POST['security_answer'] ?? '';
$current_password = $_POST['current_password'] ?? '';

// Cek jika petunjuk atau password konfirmasi kosong
if (empty($security_prompt) || empty($current_password)) {
    $_SESSION['error'] = 'Petunjuk dan Password Saat Ini wajib diisi.';
    header("Location: $redirect_page");
    exit();
}

// --- 3. Verifikasi Password Lama ---
try {
    // Ambil hash password lama dari database
    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if (!$user) {
        $_SESSION['error'] = 'User tidak ditemukan.';
        header("Location: $redirect_page");
        exit();
    }

    // Verifikasi password lama
    if (!password_verify($current_password, $user['password'])) {
        $_SESSION['error'] = 'Password Saat Ini yang Anda masukkan salah.';
        header("Location: $redirect_page");
        exit();
    }

    // --- Password BENAR, Lanjutkan Proses ---

    // Cek apakah user ingin MENGUBAH jawaban (jika field jawaban tidak kosong)
    if (!empty($security_answer)) {
        // Hash jawaban baru
        $answer_hash = password_hash($security_answer, PASSWORD_DEFAULT);

        // Update petunjuk DAN jawaban
        $stmt_update = $conn->prepare("UPDATE users SET security_prompt = ?, security_answer_hash = ? WHERE id = ?");
        $stmt_update->bind_param("ssi", $security_prompt, $answer_hash, $user_id);
    } else {
        // Jika user mengosongkan jawaban, dia HANYA ingin update petunjuk
        $stmt_update = $conn->prepare("UPDATE users SET security_prompt = ? WHERE id = ?");
        $stmt_update->bind_param("si", $security_prompt, $user_id);
    }

    // Eksekusi update
    if ($stmt_update->execute()) {
        $_SESSION['success'] = 'Pengaturan keamanan berhasil disimpan!';
    } else {
        $_SESSION['error'] = 'Gagal menyimpan pengaturan: ' . $stmt_update->error;
    }

    $stmt_update->close();
    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    $_SESSION['error'] = 'Terjadi kesalahan: ' . $e->getMessage();
}

// Kembalikan user ke halaman pengaturan
header("Location: $redirect_page");
exit();
