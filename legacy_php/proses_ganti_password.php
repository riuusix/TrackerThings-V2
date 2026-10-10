<?php
// --- 1. Memulai session dan validasi ---
require_once 'koneksi.php';

// Cek jika user belum login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

$user_id = $_SESSION['user_id'];

// Hanya izinkan metode POST
if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    $_SESSION['error'] = 'Metode tidak diizinkan.';
    header("Location: ubah_password.php");
    exit();
}

// --- 2. Ambil dan Validasi Input Form ---
$current_password = $_POST['current_password'] ?? '';
$new_password     = $_POST['new_password'] ?? '';
$confirm_password = $_POST['confirm_password'] ?? '';

// Cek jika ada input yang kosong
if (empty($current_password) || empty($new_password) || empty($confirm_password)) {
    $_SESSION['error'] = 'Semua field wajib diisi.';
    header("Location: ubah_password.php");
    exit();
}

// Cek jika password baru dan konfirmasi tidak cocok
if ($new_password !== $confirm_password) {
    $_SESSION['error'] = 'Password baru dan konfirmasi password tidak cocok.';
    header("Location: ubah_password.php");
    exit();
}

// Cek validasi kekuatan password (minimal 8 karakter, ada huruf besar, kecil, angka, spesial)
if (strlen($new_password) < 8 || !preg_match('/[A-Z]/', $new_password) || !preg_match('/[a-z]/', $new_password) || !preg_match('/[0-9]/', $new_password) || !preg_match('/[\W_]/', $new_password)) {
    $_SESSION['error'] = 'Password baru tidak memenuhi syarat. (Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan simbol).';
    header("Location: ubah_password.php");
    exit();
}

// --- 3. Verifikasi Password Lama dan Update ---
try {
    // Ambil hash password lama dari database
    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if (!$user) {
        $_SESSION['error'] = 'User tidak ditemukan.';
        header("Location: ubah_password.php");
        exit();
    }

    // Verifikasi password lama
    if (!password_verify($current_password, $user['password'])) {
        $_SESSION['error'] = 'Password lama yang Anda masukkan salah.';
        header("Location: ubah_password.php");
        exit();
    }

    // --- SEMUA VALIDASI LOLOS ---

    // Hash password BARU untuk disimpan
    $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);

    // Update password di database
    // Update password DAN catat waktunya
    $stmt_update = $conn->prepare("UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?");
    $stmt_update->bind_param("si", $new_password_hash, $user_id);

    if ($stmt_update->execute()) {
        $_SESSION['success'] = 'Password Anda telah berhasil diubah!';
        // Sukses!
    } else {
        // Gagal update
        $_SESSION['error'] = 'Gagal memperbarui password di database: ' . $stmt_update->error;
    }

    $stmt_update->close();
    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    // Tangani jika ada error koneksi DB
    $_SESSION['error'] = 'Terjadi kesalahan: ' . $e->getMessage();
}

// Kembalikan user ke halaman ubah password (dengan notifikasi)
header("Location: ubah_password.php");
exit();
