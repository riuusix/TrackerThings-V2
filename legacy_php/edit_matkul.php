<?php
require_once 'koneksi.php';
$id = $_GET['id'];
$stmt = $conn->prepare("SELECT * FROM jadwal WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$result = $stmt->get_result();
$matkul = $result->fetch_assoc();
?>
<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8" name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Mata Kuliah</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
        }
    </script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <style>
        @import url('https://rsms.me/inter/inter.css');

        html {
            font-family: 'Inter', sans-serif;
        }

        [x-cloak] {
            display: none !important;
        }

        /* Styling untuk flatpickr */
        .flatpickr-calendar {
            font-family: 'Inter', sans-serif;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            border: 1px solid #e5e7eb;
        }

        .dark .flatpickr-calendar {
            background: #1f2937;
            border-color: #374151;
        }

        .dark .flatpickr-day,
        .dark .flatpickr-weekday,
        .dark .flatpickr-months .flatpickr-month,
        .dark .numInput,
        .dark .flatpickr-time .flatpickr-am-pm {
            color: #d1d5db;
        }

        .dark .flatpickr-day:hover,
        .dark .flatpickr-day.flatpickr-disabled:hover {
            background: #374151;
        }

        .dark .flatpickr-day.today {
            border-color: #6b7280;
        }

        .dark .flatpickr-day.selected {
            background: #3b82f6;
            border-color: #3b82f6;
        }

        .dark span.flatpickr-weekday {
            color: #9ca3af;
        }
    </style>
</head>

<body class="bg-gray-100 dark:bg-gray-900 flex items-center justify-center min-h-screen p-6 antialiased transition-colors duration-300">

    <!-- Container Card -->
    <div class="bg-white dark:bg-gray-800 p-6 sm:p-8 lg:p-10 rounded-2xl shadow-lg w-full max-w-md md:max-w-3xl">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-8 text-center">Edit Mata Kuliah</h1>

        <form
            x-data="{
                init() {
                    flatpickr(this.$refs.waktu_mulai, { enableTime: true, noCalendar: true, dateFormat: 'H:i:s', time_24hr: true, defaultDate: '<?php echo $matkul['waktu_mulai']; ?>' });
                    flatpickr(this.$refs.waktu_selesai, { enableTime: true, noCalendar: true, dateFormat: 'H:i:s', time_24hr: true, defaultDate: '<?php echo $matkul['waktu_selesai']; ?>' });
                }
            }"
            action="proses_edit_matkul.php" method="POST" class="space-y-6">
            <input type="hidden" name="id" value="<?php echo $matkul['id']; ?>">

            <!-- Nama Mata Kuliah -->
            <div>
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Mata Kuliah</label>
                <input type="text" name="nama_matkul" value="<?php echo htmlspecialchars($matkul['nama_matkul']); ?>" required
                    class="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-200 px-3 py-2">
            </div>

            <!-- Nama Dosen -->
            <div>
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Dosen</label>
                <input type="text" name="dosen" value="<?php echo htmlspecialchars($matkul['dosen'] ?? ''); ?>"
                    class="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-200 px-3 py-2">
            </div>

            <!-- Kategori -->
            <div x-data="{ open: false, selectedValue: '<?php echo htmlspecialchars($matkul['kategori'] ?: 'Teori'); ?>' }" class="relative">
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Kategori</label>
                <input type="hidden" name="kategori" x-model="selectedValue">
                <button type="button" @click="open = !open"
                    class="relative w-full rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left border border-gray-300 dark:border-gray-600 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <span class="block truncate text-gray-800 dark:text-gray-200" x-text="selectedValue"></span>
                    <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                        <svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </span>
                </button>
                <div x-show="open" @click.away="open = false" x-cloak
                    class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                    <a @click="selectedValue = 'Teori'; open = false;" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">Teori</a>
                    <a @click="selectedValue = 'Praktikum'; open = false;" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">Praktikum</a>
                    <a @click="selectedValue = 'Gabungan'; open = false;" class="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">Gabungan</a>
                </div>
            </div>

            <div class="w-full">
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Lokasi/Ruangan
                </label>
                <input
                    type="text"
                    name="lokasi"
                    value="<?php echo htmlspecialchars($matkul['lokasi'] ?? ''); ?>"
                    class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
               text-gray-800 dark:text-gray-200 rounded-lg shadow-sm 
               focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
            </div>

            <!-- Hari dan Jam -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <!-- Hari -->
                <div x-data="{ open: false, selectedValue: '<?php echo htmlspecialchars($matkul['hari']); ?>' }" class="relative">
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Hari</label>
                    <input type="hidden" name="hari" x-model="selectedValue">

                    <!-- Tombol Dropdown -->
                    <button type="button" @click="open = !open"
                        class="relative w-full rounded-lg bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left 
               border border-gray-300 dark:border-gray-600 shadow-sm 
               focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <span class="block truncate text-gray-800 dark:text-gray-100" x-text="selectedValue"></span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <svg class="h-5 w-5 text-gray-400 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                    d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                    </button>

                    <!-- Dropdown List -->
                    <div x-show="open" @click.away="open = false" x-cloak
                        class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 
               shadow-lg max-h-60 rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto">
                        <template x-for="hari in ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']">
                            <a @click="selectedValue = hari; open = false;"
                                class="block px-4 py-2 text-gray-800 dark:text-gray-100 
                       hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors duration-150"
                                x-text="hari"></a>
                        </template>
                    </div>
                </div>

                <!-- Jam -->
                <div></div>
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Mulai</label>
                    <input x-ref="waktu_mulai" type="text" name="waktu_mulai" required
                        class="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-200">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Selesai</label>
                    <input x-ref="waktu_selesai" type="text" name="waktu_selesai" required
                        class="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-200">
                </div>
            </div>

            <!-- Tombol -->
            <div class="flex flex-col sm:flex-row gap-4 pt-6">
                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-all">
                    Simpan Perubahan
                </button>
                <a href="matakuliah.php" class="w-full text-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                    Batal
                </a>
            </div>
        </form>
    </div>
</body>

</html>