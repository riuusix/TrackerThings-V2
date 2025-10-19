<?php
// security_helpers.php
session_start();

/**
 * Cek login user. Kembalikan user_id jika login valid.
 * Redirect ke error.php kalau tidak login.
 */
function require_login()
{
    if (!isset($_SESSION['user_id'])) {
        $_SESSION['error_reason'] = 'unauthorized';
        header("Location: error.php");
        exit();
    }
    return $_SESSION['user_id'];
}

/**
 * Validasi input numeric (ID dll). 
 * Redirect ke error.php jika invalid.
 */
function validate_numeric($value)
{
    if (!isset($value) || !is_numeric($value)) {
        $_SESSION['error_reason'] = 'invalid_id';
        header("Location: error.php");
        exit();
    }
    return (int)$value;
}

/**
 * Cek apakah record ada di tabel tertentu.
 * Redirect ke error.php jika tidak ada.
 */
function check_existence($conn, string $table, int $id)
{
    $stmt = $conn->prepare("SELECT id FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        $_SESSION['error_reason'] = 'invalid_id';
        header("Location: error.php");
        exit();
    }

    $stmt->close();
}

/**
 * Cek kepemilikan record berdasarkan user_id.
 * $user_id → id user yang sedang login
 * $column_user_id → nama kolom user_id di tabel
 */
function check_ownership($conn, string $table, int $id, int $user_id, string $column_user_id = 'user_id')
{
    $stmt = $conn->prepare("SELECT $column_user_id FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows === 0) {
        $_SESSION['error_reason'] = 'invalid_id';
        header("Location: error.php");
        exit();
    }

    $owner_id = null;
    $stmt->bind_result($owner_id);
    $stmt->fetch();

    if ($owner_id !== $user_id) {
        $_SESSION['error_reason'] = 'forbidden';
        header("Location: error.php");
        exit();
    }

    $stmt->close();
}

/**
 * Hapus record dari tabel tertentu.
 * Redirect ke error.php kalau gagal.
 */
function delete_data($conn, string $table, int $id)
{
    $stmt = $conn->prepare("DELETE FROM $table WHERE id = ?");
    $stmt->bind_param("i", $id);

    if (!$stmt->execute() || $stmt->affected_rows === 0) {
        $_SESSION['error_reason'] = 'server_error';
        header("Location: error.php");
        exit();
    }

    $stmt->close();
}
