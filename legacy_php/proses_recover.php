<?php
require_once 'koneksi.php';
// session_start();
header('Content-Type: application/json'); // Pastikan balasan selalu JSON

// Siapkan respons default
$response = ['status' => 'error', 'message' => 'Terjadi kesalahan.'];

// Verifikasi sesi pemulihan (dibuat oleh recover_account.php)
if (!isset($_SESSION['recovery_user_id'])) {
    $response['message'] = 'Sesi pemulihan tidak valid atau telah kedaluwarsa.';
    echo json_encode($response);
    exit();
}

$user_id = $_SESSION['recovery_user_id'];
$action = $_POST['action'] ?? '';

switch ($action) {

    // --- 'WUJUD 1' MENGIRIM INI ---
    case 'verify_answer':
        $security_answer = $_POST['security_answer'] ?? '';

        // Ambil hash jawaban dari DB
        $stmt = $conn->prepare("SELECT security_answer_hash FROM users WHERE id = ?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();

        if ($user && password_verify($security_answer, $user['security_answer_hash'])) {
            // JAWABAN BENAR
            $response['status'] = 'success';
            $response['message'] = 'Verifikasi berhasil.';
            // Set flag di sesi bahwa Wujud 1 sudah lolos
            $_SESSION['recovery_step_2_ok'] = true;
        } else {
            // JAWABAN SALAH
            $response['message'] = 'Jawaban rahasia salah.';
        }
        $stmt->close();
        break;

    // --- 'WUJUD 2' MENGIRIM INI ---
    case 'reset_password':
        // Cek apakah user sudah lolos Wujud 1
        if (!isset($_SESSION['recovery_step_2_ok'])) {
            $response['message'] = 'Verifikasi jawaban belum dilakukan.';
            echo json_encode($response);
            exit();
        }

        $new_password = $_POST['new_password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';

        if ($new_password !== $confirm_password) {
            $response['message'] = 'Password baru dan konfirmasi tidak cocok.';
            break;
        }

        // Validasi kekuatan password (harus sama dengan di 'akun.php')
        if (strlen($new_password) < 8 || !preg_match('/[A-Z]/', $new_password) || !preg_match('/[a-z]/', $new_password) || !preg_match('/[0-9]/', $new_password) || !preg_match('/[\W_]/', $new_password)) {
            $response['message'] = 'Password baru tidak memenuhi syarat. (Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan simbol).';
            break;
        }

        // Hash password baru
        $new_password_hash = password_hash($new_password, PASSWORD_DEFAULT);

        // Update password di DB
        $stmt = $conn->prepare("UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?");
        $stmt->bind_param("si", $new_password_hash, $user_id);

        if ($stmt->execute()) {
            $response['status'] = 'success';
            $response['message'] = 'Password berhasil diubah.';

            // Hancurkan sesi pemulihan agar tidak bisa dipakai lagi
            unset($_SESSION['recovery_user_id']);
            unset($_SESSION['recovery_step_2_ok']);
        } else {
            $response['message'] = 'Gagal memperbarui password di database.';
        }
        $stmt->close();
        break;

    default:
        $response['message'] = 'Aksi tidak diketahui.';
        break;
}

$conn->close();
echo json_encode($response);
exit();
