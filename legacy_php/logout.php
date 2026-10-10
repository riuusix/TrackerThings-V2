<?php
// Selalu mulai session di awal
session_start();

// Hapus semua variabel session
$_SESSION = [];

// Hancurkan session
session_destroy();

// Alihkan ke halaman login
header("Location: login.php");
exit();
