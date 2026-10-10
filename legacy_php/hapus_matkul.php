<?php
require_once 'koneksi.php';
require_once 'security_helpers.php';

// 1️⃣ Cek login
$user_id = require_login();

// 2️⃣ Validasi ID matkul
$id_matkul = validate_numeric($_POST['id_matkul'] ?? $_GET['id'] ?? null);

// 3️⃣ Cek kepemilikan
check_ownership($conn, 'jadwal', $id_matkul, $user_id);

// 4️⃣ Hapus data
delete_data($conn, 'jadwal', $id_matkul);

$conn->close();

// 5️⃣ Redirect ke halaman utama dengan notifikasi
header("Location: matakuliah.php?status=dihapus");
exit();
