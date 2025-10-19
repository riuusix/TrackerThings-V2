<?php
require_once 'koneksi.php';
require_once 'security_helpers.php';

// 1️⃣ Cek login
$user_id = require_login();

// 2️⃣ Validasi ID tugas
$id_tugas = validate_numeric($_POST['id_tugas'] ?? null);

// 3️⃣ Cek kepemilikan
check_ownership($conn, 'tugas', $id_tugas, $user_id);

// 4️⃣ Delete data
delete_data($conn, 'tugas', $id_tugas);

// ✅ Kirim JSON response untuk AJAX
header('Content-Type: application/json');
echo json_encode([
    'status' => 'success',
    'message' => 'Tugas berhasil dihapus.'
]);

$conn->close();
exit();
