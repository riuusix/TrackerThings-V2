<?php
// --- 1. Memulai session dan mengatur header JSON ---
require_once 'koneksi.php';
header('Content-Type: application/json');

// --- 2. Validasi Login ---
// Cek apakah user sudah login, jika tidak kirim respons error
if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Akses ditolak. Silakan login terlebih dahulu.'
    ]);
    exit;
}

// Ambil user_id yang aman dari session
$user_id = $_SESSION['user_id'];

// --- 3. Validasi Metode Request ---
if ($_SERVER['REQUEST_METHOD'] != 'POST') {
    echo json_encode([
        'status' => 'error',
        'message' => 'Metode request tidak valid.'
    ]);
    exit;
}

// --- 4. Ambil dan Validasi Data POST ---
// Ambil semua data dari form (sama seperti skrip pertama Anda)
$id_tugas   = $_POST['id_tugas'] ?? null;
$nama_tugas = $_POST['nama_tugas'] ?? null;
$deadline   = $_POST['deadline'] ?? null;
$id_jadwal  = $_POST['id_jadwal'] ?? null;
$prioritas  = $_POST['prioritas'] ?? null;
$jenis      = $_POST['jenis'] ?? null;

// Validasi dasar, pastikan data yang wajib ada tidak kosong
if (!$id_tugas || !$nama_tugas || !$deadline || !$id_jadwal || !$prioritas || !$jenis) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Data tidak lengkap. Semua field wajib diisi.'
    ]);
    exit;
}

// --- 5. Logika Database (Prepare, Bind, Execute) ---

// Query UPDATE dengan klausa "AND user_id = ?" untuk keamanan
$stmt = $conn->prepare("UPDATE tugas 
                        SET nama_tugas = ?, deadline = ?, id_jadwal = ?, prioritas = ?, jenis = ? 
                        WHERE id = ? AND user_id = ?");

if (!$stmt) {
    echo json_encode(['status' => 'error', 'message' => 'Gagal menyiapkan statement: ' . $conn->error]);
    exit();
}

// Bind parameter (ssissii)
// s = nama_tugas
// s = deadline
// i = id_jadwal
// s = prioritas
// s = jenis
// i = id_tugas
// i = user_id
$stmt->bind_param(
    "ssissii",
    $nama_tugas,
    $deadline,
    $id_jadwal,
    $prioritas,
    $jenis,
    $id_tugas,
    $user_id
);

// --- 6. Eksekusi dan Kirim Respons JSON ---
if ($stmt->execute()) {
    // Cek apakah ada baris yang benar-benar terpengaruh
    // (menggunakan logika dari skrip kedua Anda)
    if ($stmt->affected_rows > 0) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Tugas berhasil diperbarui!'
        ]);
    } else {
        // Ini terjadi jika ID tugas tidak ditemukan, bukan milik user,
        // atau datanya sama persis (tidak ada yang di-update)
        echo json_encode([
            'status' => 'error', // Anda bisa ganti 'info' jika mau
            'message' => 'Tidak ada perubahan disimpan. (Tugas tidak ditemukan, data sama, atau Anda tidak memiliki izin).'
        ]);
    }
} else {
    // Gagal saat eksekusi
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal memperbarui tugas: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
