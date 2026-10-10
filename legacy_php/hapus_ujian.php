<?php
require_once 'koneksi.php';
require_once 'security_helpers.php';

// 1️⃣ Cek login
$user_id = require_login();

// 2️⃣ Validasi ID
$id_ujian = validate_numeric($_GET['id'] ?? null);

// 3️⃣ Cek eksistensi data
check_existence($conn, 'ujian', $id_ujian);

// 4️⃣ (Opsional) Cek kepemilikan jika tabel punya user_id
// check_ownership($conn, 'ujian', $id_ujian, $user_id);

// 5️⃣ Hapus data
delete_data($conn, 'ujian', $id_ujian);

// ✅ Success
$_SESSION['success_message'] = 'Data ujian berhasil dihapus.';
header("Location: ujian.php");
exit();
