<?php
require_once 'koneksi.php';

// --- 1. Keamanan & Inisialisasi ---
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit();
}
$user_id = $_SESSION['user_id'];

// Tentukan folder upload. Pastikan folder 'uploads/' ini ADA di server Anda.
$upload_dir = 'uploads/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true); // Coba buat folder jika tidak ada
}

// Hanya proses jika metodenya POST
if ($_SERVER['REQUEST_METHOD'] == 'POST') {

    // --- 2. Ambil Data Teks dari Form ---
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $phone_number = $_POST['phone_number'];
    $old_profile_picture = $_POST['old_profile_picture']; // Path foto lama

    $new_picture_path = null; // Path untuk foto baru

    // --- 3. Logika Upload File ---
    // Cek apakah ada file baru yang di-upload
    if (isset($_FILES['profile_picture']) && $_FILES['profile_picture']['error'] == 0) {

        $file = $_FILES['profile_picture'];

        // Validasi Ukuran (misal: 2MB)
        $max_size = 2 * 1024 * 1024; // 2MB
        if ($file['size'] > $max_size) {
            $_SESSION['error'] = 'Gagal upload: Ukuran file terlalu besar (Maks 2MB).';
            header("Location: profile.php");
            exit();
        }

        // Validasi Tipe File
        $allowed_types = ['image/jpeg', 'image/png', 'image/jpg'];
        $file_info = getimagesize($file['tmp_name']);

        if (!$file_info || !in_array($file_info['mime'], $allowed_types)) {
            $_SESSION['error'] = 'Gagal upload: Tipe file tidak valid (Hanya .jpg atau .png).';
            header("Location: profile.php");
            exit();
        }

        // Buat nama file unik untuk menghindari konflik
        // Format: user_[ID]_[timestamp].[extensi]
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $new_filename = 'user_' . $user_id . '_' . time() . '.' . $extension;
        $new_picture_path = $upload_dir . $new_filename;

        // Pindahkan file dari temporary ke folder 'uploads/'
        if (move_uploaded_file($file['tmp_name'], $new_picture_path)) {
            // Sukses upload file baru

            // Hapus file lama jika ada (dan bukan file default)
            if (!empty($old_profile_picture) && file_exists($old_profile_picture)) {
                unlink($old_profile_picture); // Hapus foto lama dari server
            }
        } else {
            // Gagal memindahkan file
            $_SESSION['error'] = 'Gagal menyimpan file yang di-upload.';
            header("Location: profile.php");
            exit();
            $new_picture_path = null; // Set kembali ke null jika gagal
        }
    }

    // --- 4. Validasi Email Duplikat ---
    $stmt_check_email = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $stmt_check_email->bind_param("si", $email, $user_id);
    $stmt_check_email->execute();
    if ($stmt_check_email->get_result()->num_rows > 0) {
        $_SESSION['error'] = 'Email sudah digunakan oleh akun lain.';
        header("Location: profile.php");
        exit();
    }
    $stmt_check_email->close();

    // --- 5. Logika Update Database ---

    // Kita akan membangun query berdasarkan apakah ada foto baru atau tidak
    $params = []; // Array untuk menampung parameter bind
    $types = ""; // String untuk tipe bind_param

    if ($new_picture_path !== null) {
        // --- Jika ADA FOTO BARU ---
        $sql = "UPDATE users SET full_name = ?, email = ?, phone_number = ?, profile_picture_url = ?, profile_updated_at = NOW() WHERE id = ?";
        $types = "ssssi";
        $params = [$full_name, $email, $phone_number, $new_picture_path, $user_id];
    } else {
        // --- Jika TIDAK ADA FOTO BARU ---
        $sql = "UPDATE users SET full_name = ?, email = ?, phone_number = ?, profile_updated_at = NOW() WHERE id = ?";
        $types = "sssi";
        $params = [$full_name, $email, $phone_number, $user_id];
    }

    $stmt_update = $conn->prepare($sql);

    if (!$stmt_update) {
        $_SESSION['error'] = 'Gagal menyiapkan query: ' . $conn->error;
        header("Location: profile.php");
        exit();
    }

    // Bind parameter secara dinamis
    $stmt_update->bind_param($types, ...$params);

    // 6. Eksekusi query update
    if ($stmt_update->execute()) {
        $_SESSION['success'] = 'Profil berhasil diperbarui.';
    } else {
        $_SESSION['error'] = 'Gagal memperbarui profil: ' . $stmt_update->error;
    }
    $stmt_update->close();
    $conn->close();
} // Tutup 'if ($_SERVER...)'

// 7. Selalu redirect kembali
header("Location: profile.php");
exit();
