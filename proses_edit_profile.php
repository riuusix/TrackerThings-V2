<?php
session_start();
require_once 'koneksi.php';

// Keamanan: Pastikan user sudah login
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}

$user_id = $_SESSION['user_id'];

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Ambil data non-password
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $phone_number = $_POST['phone_number'];

    // Ambil data password
    $current_password = $_POST['current_password'];
    $new_password = $_POST['new_password'];
    $confirm_password = $_POST['confirm_password'];

    // Cek duplikasi email (jika email diubah)
    $stmt_check_email = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmt_check_email->bind_param("si", $email, $user_id);
    $stmt_check_email->execute();
    if ($stmt_check_email->get_result()->num_rows > 0) {
        $_SESSION['error'] = 'Email sudah digunakan oleh akun lain.';
        header("Location: profile.php");
        exit();
    }
    $stmt_check_email->close();

    // Logika untuk mengubah password
    if (!empty($new_password)) {
        if (empty($current_password) || empty($confirm_password)) {
            $_SESSION['error'] = 'Untuk mengubah password, semua field password harus diisi.';
            header("Location: profile.php");
            exit();
        }

        if ($new_password !== $confirm_password) {
            $_SESSION['error'] = 'Password baru dan konfirmasi tidak cocok.';
            header("Location: profile.php");
            exit();
        }

        // Verifikasi password lama
        $stmt_pass = $conn->prepare("SELECT password FROM users WHERE id = ?");
        $stmt_pass->bind_param("i", $user_id);
        $stmt_pass->execute();
        $user_data = $stmt_pass->get_result()->fetch_assoc();

        if (password_verify($current_password, $user_data['password'])) {
            // Jika password lama benar, hash password baru dan update semuanya
            $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
            $stmt_update = $conn->prepare("UPDATE users SET full_name = ?, email = ?, phone_number = ?, password = ? WHERE id = ?");
            $stmt_update->bind_param("ssssi", $full_name, $email, $phone_number, $hashed_password, $user_id);
        } else {
            $_SESSION['error'] = 'Password lama yang Anda masukkan salah.';
            header("Location: profile.php");
            exit();
        }
        $stmt_pass->close();
    } else {
        // Jika tidak ada perubahan password, update data lainnya saja
        $stmt_update = $conn->prepare("UPDATE users SET full_name = ?, email = ?, phone_number = ? WHERE id = ?");
        $stmt_update->bind_param("sssi", $full_name, $email, $phone_number, $user_id);
    }

    // Eksekusi query update
    if ($stmt_update->execute()) {
        $_SESSION['success'] = 'Profil berhasil diperbarui.';
    } else {
        $_SESSION['error'] = 'Gagal memperbarui profil.';
    }
    $stmt_update->close();
}

header("Location: profile.php");
exit();
