<?php
// --- PERBAIKAN 1: Memulai session dan validasi login ---
session_start();
require_once 'koneksi.php';

// Atur header JSON untuk AJAX
header('Content-Type: application/json');

// --- STEP 1: Cek login ---
if (!isset($_SESSION['user_id'])) {
    $_SESSION['error_message'] = 'Akses ditolak. Silakan login terlebih dahulu.';
    header('Location: error.php');
    exit();
}

$user_id = $_SESSION['user_id'];

// --- STEP 2: Validasi metode request ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    $_SESSION['error_message'] = 'Metode request tidak valid.';
    header('Location: error.php');
    exit();
}

// --- STEP 3: Ambil dan validasi data input ---
$nama_tugas = trim($_POST['nama_tugas'] ?? '');
$deadline   = trim($_POST['deadline'] ?? '');
$id_jadwal  = $_POST['id_jadwal'] ?? null;
$prioritas  = $_POST['prioritas'] ?? null;
$jenis      = trim($_POST['jenis'] ?? '');

if (empty($nama_tugas) || empty($deadline) || empty($id_jadwal) || empty($prioritas) || empty($jenis)) {
    $_SESSION['error_message'] = 'Semua field wajib diisi.';
    header('Location: error.php');
    exit();
}

// --- STEP 4: Query tambah tugas ---
$stmt = $conn->prepare("INSERT INTO tugas (nama_tugas, deadline, id_jadwal, prioritas, jenis, user_id) VALUES (?, ?, ?, ?, ?, ?)");

if (!$stmt) {
    $_SESSION['error_message'] = 'Gagal menyiapkan query: ' . $conn->error;
    header('Location: error.php');
    exit();
}

$stmt->bind_param("ssissi", $nama_tugas, $deadline, $id_jadwal, $prioritas, $jenis, $user_id);

if (!$stmt->execute()) {
    $_SESSION['error_message'] = 'Gagal menambahkan tugas: ' . $stmt->error;
    header('Location: error.php');
    exit();
}

// --- STEP 5: Ambil nama matkul ---
$nama_matkul = 'N/A';
$stmt_matkul = $conn->prepare("SELECT nama_matkul FROM jadwal WHERE id = ?");
$stmt_matkul->bind_param("i", $id_jadwal);
if ($stmt_matkul->execute()) {
    $result_matkul = $stmt_matkul->get_result();
    if ($row = $result_matkul->fetch_assoc()) {
        $nama_matkul = $row['nama_matkul'];
    }
}
$stmt_matkul->close();

// --- STEP 6: Kirim respons sukses ke AJAX ---
echo json_encode([
    'status' => 'success',
    'message' => 'Tugas berhasil ditambahkan',
    'newTask' => [
        'id' => $stmt->insert_id,
        'nama_tugas' => $nama_tugas,
        'deadline' => $deadline,
        'id_jadwal' => $id_jadwal,
        'prioritas' => $prioritas,
        'jenis' => $jenis,
        'progress' => 0,
        'status' => 'Belum Dikerjakan',
        'user_id' => $user_id,
        'nama_matkul' => $nama_matkul
    ]
]);

$stmt->close();
$conn->close();
