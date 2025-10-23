<?php
// security_helpers.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Kirim response JSON error & hentikan eksekusi
 */
function json_error($reason, $message)
{
    $_SESSION['error_reason'] = $reason;
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'error',
        'reason' => $reason,
        'message' => $message
    ]);
    exit();
}

/**
 * Cek login user. Kembalikan user_id jika login valid.
 * Redirect ke error.php atau kirim JSON kalau $jsonMode = true.
 */
function require_login($jsonMode = false)
{
    if (!isset($_SESSION['user_id'])) {
        if ($jsonMode) {
            json_error('unauthorized', 'Anda harus login terlebih dahulu.');
        } else {
            $_SESSION['error_reason'] = 'unauthorized';
            header("Location: error.php");
            exit();
        }
    }
    return $_SESSION['user_id'];
}

/**
 * Validasi input numeric (ID dll). 
 * Redirect ke error.php atau kirim JSON kalau $jsonMode = true.
 */
function validate_numeric($value, $jsonMode = false)
{
    if (!isset($value) || !is_numeric($value)) {
        if ($jsonMode) {
            json_error('invalid_id', 'ID tidak valid.');
        } else {
            $_SESSION['error_reason'] = 'invalid_id';
            header("Location: error.php");
            exit();
        }
    }
    return (int)$value;
}

/**
 * Cek apakah record ada di tabel tertentu.
 * Redirect ke error.php atau kirim JSON kalau $jsonMode = true.
 */
function check_existence($conn, string $table, int $id, $jsonMode = false)
{
    $stmt = $conn->prepare("SELECT id FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        if ($jsonMode) {
            json_error('invalid_id', 'Data tidak ditemukan.');
        } else {
            $_SESSION['error_reason'] = 'invalid_id';
            header("Location: error.php");
            exit();
        }
    }

    $stmt->close();
}

/**
 * Cek kepemilikan record berdasarkan user_id.
 * $user_id → id user yang sedang login
 * $column_user_id → nama kolom user_id di tabel
 */
function check_ownership($conn, string $table, int $id, int $user_id, string $column_user_id = 'user_id', $jsonMode = false)
{
    $stmt = $conn->prepare("SELECT $column_user_id FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        if ($jsonMode) {
            json_error('invalid_id', 'Data tidak ditemukan.');
        } else {
            $_SESSION['error_reason'] = 'invalid_id';
            header("Location: error.php");
            exit();
        }
    }

    $owner_id = null;
    $stmt->bind_result($owner_id);
    $stmt->fetch();

    if ($owner_id !== $user_id) {
        if ($jsonMode) {
            json_error('forbidden', 'Anda tidak memiliki akses ke data ini.');
        } else {
            $_SESSION['error_reason'] = 'forbidden';
            header("Location: error.php");
            exit();
        }
    }

    $stmt->close();
}

/**
 * Hapus record dari tabel tertentu.
 * Redirect ke error.php atau kirim JSON kalau $jsonMode = true.
 */
function delete_data($conn, string $table, int $id, $jsonMode = false)
{
    $stmt = $conn->prepare("DELETE FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);

    if (!$stmt->execute() || $stmt->affected_rows === 0) {
        if ($jsonMode) {
            json_error('server_error', 'Gagal menghapus data.');
        } else {
            $_SESSION['error_reason'] = 'server_error';
            header("Location: error.php");
            exit();
        }
    }

    $stmt->close();
}
