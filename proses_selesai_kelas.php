<?php
require_once 'koneksi.php';
header('Content-Type: application/json');

$response = ['status' => 'error', 'message' => 'Terjadi kesalahan.'];

// 1. Validasi User
if (!isset($_SESSION['user_id'])) {
    $response['message'] = 'Akses ditolak. Silakan login.';
    echo json_encode($response);
    exit();
}
$user_id = $_SESSION['user_id'];

// 2. Validasi Input
$kelas_id = $_POST['id_kelas_pengganti'] ?? null;
if (empty($kelas_id)) {
    $response['message'] = 'ID Kelas tidak valid.';
    echo json_encode($response);
    exit();
}

// 3. Update Database
try {
    $stmt = $conn->prepare("UPDATE kelas_pengganti SET status = 'Selesai' WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $kelas_id, $user_id);

    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            $response['status'] = 'success';
            $response['message'] = 'Kelas berhasil diarsipkan!';
        } else {
            $response['message'] = 'Kelas tidak ditemukan atau sudah diarsipkan.';
        }
    } else {
        $response['message'] = 'Gagal mengeksekusi query.';
    }
    $stmt->close();
} catch (Exception $e) {
    $response['message'] = 'Error database: ' . $e->getMessage();
}

$conn->close();
echo json_encode($response);
exit();
