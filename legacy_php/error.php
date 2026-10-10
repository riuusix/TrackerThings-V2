<?php
session_start();

// Ambil reason dari session, default 'unknown'
$reason = $_SESSION['error_reason'] ?? 'unknown';
unset($_SESSION['error_reason']);

// Pesan dan ikon
$errors = [
    // 🧭 Autentikasi & Autorisasi
    'unauthorized' => [
        'title' => 'Akses Ditolak',
        'message' => '🔒 Anda harus login terlebih dahulu.',
        'icon' => '🔒'
    ],
    'login_expired' => [
        'title' => 'Sesi Kadaluarsa',
        'message' => '⌛ Sesi login Anda telah berakhir. Silakan login kembali.',
        'icon' => '⌛'
    ],
    'not_admin' => [
        'title' => 'Akses Terbatas',
        'message' => '🛡️ Anda tidak memiliki hak untuk mengakses halaman ini.',
        'icon' => '🛡️'
    ],

    // 📝 Validasi Input
    'invalid_input' => [
        'title' => 'Input Tidak Valid',
        'message' => '⚠️ Data yang Anda masukkan tidak sesuai format.',
        'icon' => '📝'
    ],
    'missing_field' => [
        'title' => 'Field Kosong',
        'message' => '🚧 Ada data penting yang belum diisi.',
        'icon' => '🚧'
    ],
    'invalid_id' => [
        'title' => 'Aksi Tidak Valid',
        'message' => '⚠️ Aksi ini sangat merugikan!',
        'icon' => '⚠️'
    ],
    'forbidden' => [
        'title' => 'Aksi Terlarang',
        'message' => '🚫 Tugas ini bukan milik Anda.',
        'icon' => '🚫'
    ],

    // 🧰 Database & Server
    'db_error' => [
        'title' => 'Kesalahan Database',
        'message' => '💥 Terjadi gangguan pada database. Coba lagi nanti.',
        'icon' => '💥'
    ],
    'duplicate_entry' => [
        'title' => 'Data Duplikat',
        'message' => '⚠️ Data ini sudah ada di sistem.',
        'icon' => '🗂️'
    ],
    'server_error' => [
        'title' => 'Kesalahan Server',
        'message' => '💥 Terjadi kesalahan pada server.',
        'icon' => '💥'
    ],

    // 📂 File & Upload
    'file_not_found' => [
        'title' => 'File Tidak Ditemukan',
        'message' => '📄 File yang Anda cari tidak tersedia.',
        'icon' => '📄'
    ],
    'file_upload_failed' => [
        'title' => 'Gagal Upload File',
        'message' => '🚫 File gagal diunggah. Coba lagi.',
        'icon' => '📤'
    ],
    'file_too_large' => [
        'title' => 'File Terlalu Besar',
        'message' => '🧱 Ukuran file melebihi batas maksimal.',
        'icon' => '🧱'
    ],

    // 🌐 AJAX / API / CSRF
    'csrf_invalid' => [
        'title' => 'Token Keamanan Tidak Valid',
        'message' => '🛡️ Token CSRF tidak cocok atau sudah kedaluwarsa.',
        'icon' => '🧿'
    ],
    'ajax_failed' => [
        'title' => 'Koneksi Gagal',
        'message' => '🌐 Permintaan ke server gagal. Periksa koneksi Anda.',
        'icon' => '🌐'
    ],
    'bad_request' => [
        'title' => 'Permintaan Tidak Valid',
        'message' => '🚫 Server tidak dapat memproses permintaan ini.',
        'icon' => '🚫'
    ],

    // 📦 Resource & Route
    'resource_not_found' => [
        'title' => 'Data Tidak Ditemukan',
        'message' => '🔍 Data yang Anda cari sudah tidak tersedia.',
        'icon' => '🔍'
    ],
    'route_forbidden' => [
        'title' => 'Akses URL Terlarang',
        'message' => '🚫 Anda tidak bisa mengakses URL ini secara langsung.',
        'icon' => '🚫'
    ],
    '404' => [
        'title' => 'Halaman Tidak Ditemukan',
        'message' => '🔍 Maaf, halaman yang Anda cari tidak ada.',
        'icon' => '🗺️'
    ],

    // ❔ Unknown
    'unknown' => [
        'title' => 'Kesalahan Tidak Diketahui',
        'message' => '❔ Terjadi kesalahan yang tidak diketahui.',
        'icon' => '❔'
    ]
];

$data = $errors[$reason] ?? $errors['unknown'];
$title = $data['title'];
$message = $data['message'];
$icon = $data['icon'];
?>
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($title) ?></title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        /* Liquid glass card */
        .glass {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(22px);
            -webkit-backdrop-filter: blur(22px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: background 0.3s, border 0.3s;
        }

        /* Pulse lembut */
        @keyframes alertPulse {
            0% {
                box-shadow: 0 0 6px 2px rgba(135, 206, 235, 0.3);
            }

            50% {
                box-shadow: 0 0 15px 5px rgba(135, 206, 235, 0.35);
            }

            100% {
                box-shadow: 0 0 6px 2px rgba(135, 206, 235, 0.3);
            }
        }

        .alert-border {
            animation: alertPulse 2s infinite ease-in-out;
        }

        /* Fade in + slide up */
        @keyframes fadeInUp {
            0% {
                opacity: 0;
                transform: translateY(20px);
            }

            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .fadeInUp {
            animation: fadeInUp 0.9s ease forwards;
        }

        /* Background gradient pastel */
        @keyframes gradientMove {
            0% {
                background-position: 0% 50%;
            }

            50% {
                background-position: 100% 50%;
            }

            100% {
                background-position: 0% 50%;
            }
        }

        body {
            background: linear-gradient(-45deg, #c8d6ff, #e0c3fc, #d0f4de, #ffe0ac);
            background-size: 300% 300%;
            animation: gradientMove 15s ease infinite;
            transition: background 0.3s;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }

        /* Floating icon */
        @keyframes floatIcon {

            0%,
            100% {
                transform: translateY(0);
            }

            50% {
                transform: translateY(-12px) rotate(-3deg);
            }
        }

        .floating {
            animation: floatIcon 3s ease-in-out infinite;
        }

        /* Bubbles */
        .bubble {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            animation: bubbleMove 12s linear infinite;
        }

        @keyframes bubbleMove {
            0% {
                transform: translateY(100vh) scale(0);
                opacity: 0.2;
            }

            50% {
                opacity: 0.5;
            }

            100% {
                transform: translateY(-10vh) scale(1);
                opacity: 0;
            }
        }

        /* Light/Dark mode adaptation */
        @media (prefers-color-scheme: dark) {
            body {
                background: linear-gradient(-45deg, #2c3e50, #34495e, #1c1c2e, #0d0d1a);
            }

            .glass {
                background: rgba(30, 30, 40, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            h1,
            p,
            a {
                color: #e0e0ff;
            }
        }

        @media (prefers-color-scheme: light) {
            body {
                color: #111;
            }

            .glass {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(200, 200, 200, 0.3);
            }

            h1,
            p,
            a {
                color: #222;
            }
        }

        /* Button hover glossy */
        a.glossy {
            position: relative;
            overflow: hidden;
            display: inline-block;
            transition: background 0.3s, color 0.3s;
        }

        a.glossy::after {
            content: "";
            position: absolute;
            top: 0;
            left: -75%;
            width: 50%;
            height: 100%;
            background: linear-gradient(120deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.3));
            transform: skewX(-20deg);
            transition: all 0.5s;
        }

        a.glossy:hover::after {
            left: 125%;
            transition: all 0.5s;
        }

        a.glossy:hover {
            background-color: #3e4447ff;
            /* sedikit lebih terang dari normal */
        }
    </style>
</head>

<body class="flex items-center justify-center h-screen relative overflow-hidden">

    <!-- Bubbles -->
    <?php for ($i = 0; $i < 8; $i++): ?>
        <div class="bubble" style="width:<?= rand(20, 60) ?>px;height:<?= rand(20, 60) ?>px;left:<?= rand(5, 95) ?>%;animation-delay:<?= rand(0, 5) ?>s;"></div>
    <?php endfor; ?>

    <div class="glass alert-border p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full mx-4 relative z-10">
        <div class="mb-6 text-6xl floating"><?= htmlspecialchars($icon) ?></div>
        <h1 class="text-4xl font-bold mb-4 fadeInUp"><?= htmlspecialchars($title) ?></h1>
        <p class="text-lg mb-8 fadeInUp"><?= htmlspecialchars($message) ?></p>
        <a href="javascript:history.back()" class="px-6 py-3 bg-sky-400 text-white font-semibold rounded-full shadow-lg hover:bg-sky-500 glossy transition">
            Kembali ke Halaman Sebelumnya
        </a>
    </div>
</body>

</html>