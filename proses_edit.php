<?php
// --- 1. Memulai session, atur error reporting, dan header JSON ---
require_once 'koneksi.php';
error_reporting(0); // Mencegah PHP Notice/Warning merusak output JSON
header('Content-Type: application/json'); // Memberitahu browser bahwa ini adalah JSON


// Siapkan array untuk respons
$response = [
    'status' => 'error',
    'message' => 'Terjadi kesalahan.'
];

// --- 2. Validasi Login ---
if (!isset($_SESSION['user_id'])) {
    $response['message'] = 'Akses ditolak. Silakan login terlebih dahulu.';
    echo json_encode($response);
    exit();
}

$user_id = $_SESSION['user_id'];

// --- 3. Validasi Metode Request ---
if ($_SERVER['REQUEST_METHOD'] == 'POST') {

    // --- 4. Ambil dan Validasi Data POST ---
    $id_tugas   = $_POST['id_tugas'] ?? null;
    $nama_tugas = $_POST['nama_tugas'] ?? null;
    $deadline   = $_POST['deadline'] ?? null;
    $id_jadwal  = $_POST['id_jadwal'] ?? null;
    $prioritas  = $_POST['prioritas'] ?? null;
    $jenis      = $_POST['jenis'] ?? null;

    // Validasi data tidak boleh kosong
    if (!$id_tugas || !$nama_tugas || !$deadline || !$id_jadwal || !$prioritas || !$jenis) {
        $response['message'] = 'Data tidak lengkap. Semua field wajib diisi.';
        echo json_encode($response);
        exit();
    }

    // --- 5. Logika Database ---
    $stmt = $conn->prepare("UPDATE tugas 
                            SET nama_tugas = ?, deadline = ?, id_jadwal = ?, prioritas = ?, jenis = ? 
                            WHERE id = ? AND user_id = ?");

    if (!$stmt) {
        // Gagal menyiapkan statement
        $response['message'] = 'Gagal menyiapkan statement: ' . $conn->error;
    } else {
        // Bind parameter (ssissii)
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

        // Eksekusi statement
        if ($stmt->execute()) {
            if ($stmt->affected_rows > 0) {
                // Sukses dan ada data yang berubah
                $response['status'] = 'success';
                $response['message'] = 'Tugas berhasil diperbarui!';
            } else {
                // Sukses tapi tidak ada data yang berubah (mungkin datanya sama)
                $response['status'] = 'success'; // Tetap sukses
                $response['message'] = 'Tidak ada perubahan disimpan (data mungkin sama).';
            }
        } else {
            // Gagal saat eksekusi
            $response['message'] = 'Gagal memperbarui tugas: ' . $stmt->error;
        }
        $stmt->close();
    }
    $conn->close();
} else {
    $response['message'] = 'Metode request tidak valid.';
}

// --- 6. Kirim Respons JSON ---
// Hapus semua 'header("Location: ...")' dan 'echo' lainnya.
// Cukup cetak array $response sebagai JSON.
echo json_encode($response);
exit();

// Pastikan tidak ada spasi atau baris kosong setelah tag PHP penutup di bawah ini
