<!DOCTYPE html>
<html lang="en" x-data="{ darkMode: localStorage.getItem('darkMode') === 'true' }" x-init="$watch('darkMode', val => localStorage.setItem('darkMode', val))" :class="{ 'dark': darkMode }">

<head>
    <meta charset="UTF-8">
    <title>Tambah Mata Kuliah</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class', // Mengaktifkan dark mode berdasarkan kelas 'dark'
        }
    </script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js"></script>
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

        /* Style kustom untuk flatpickr agar menyatu dengan dark mode */
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

        .flatpickr-day.selected {
            background: #3b82f6;
            border-color: #3b82f6;
        }

        .dark .flatpickr-day.selected {
            background: #60a5fa;
        }

        .flatpickr-time .numInputWrapper span.arrowUp:after {
            border-bottom-color: #3b82f6;
        }

        .dark .flatpickr-time .numInputWrapper span.arrowUp:after {
            border-bottom-color: #60a5fa;
        }

        .flatpickr-time .numInputWrapper span.arrowDown:after {
            border-top-color: #3b82f6;
        }

        .dark .flatpickr-time .numInputWrapper span.arrowDown:after {
            border-top-color: #60a5fa;
        }
    </style>
</head>

<body class="bg-gray-100 dark:bg-gray-900 flex items-center justify-center min-h-screen p-6 transition-colors duration-300 antialiased">
    <div class="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-lg w-full max-w-3xl transition-colors duration-300">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-8 text-center">
            Tambah Mata Kuliah Baru
        </h1>

        <form x-data="{
            init() {
              flatpickr(this.$refs.waktu_mulai, { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true });
              flatpickr(this.$refs.waktu_selesai, { enableTime: true, noCalendar: true, dateFormat: 'H:i', time_24hr: true });
            }
          }"
            action="proses_tambah_matkul.php"
            method="POST"
            class="space-y-6">

            <!-- Nama Mata Kuliah & Dosen -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Mata Kuliah</label>
                    <input type="text" name="nama_matkul" placeholder="Contoh: Kalkulus I" required
                        class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nama Dosen</label>
                    <input type="text" name="dosen" placeholder="Contoh: Dr. Budi Sanjoyo"
                        class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3">
                </div>
            </div>

            <!-- Kategori -->
            <div>
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Kategori</label>
                <div x-data="{ open: false, selectedValue: 'Teori' }" class="relative">
                    <input type="hidden" name="kategori" x-model="selectedValue">
                    <button type="button" @click="open = !open"
                        class="w-full flex justify-between items-center rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-2 px-3 text-left shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-800 dark:text-gray-200">
                        <span x-text="selectedValue"></span>
                        <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <div x-show="open" @click.away="open = false" x-cloak
                        class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto">
                        <template x-for="item in ['Teori', 'Praktikum', 'Gabungan']" :key="item">
                            <a @click="selectedValue = item; open = false"
                                class="block cursor-pointer px-3 py-2 text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                x-text="item"></a>
                        </template>
                    </div>
                </div>
            </div>

            <div class="w-full">
                <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Lokasi/Ruangan
                </label>
                <input
                    type="text"
                    name="lokasi"
                    placeholder="Contoh: D.304 VB"
                    class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
               text-gray-800 dark:text-gray-200 rounded-lg shadow-sm 
               focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
            </div>


            <!-- Hari & Waktu -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Hari</label>
                    <div x-data="{ open: false, selectedValue: 'Senin' }" class="relative">
                        <input type="hidden" name="hari" x-model="selectedValue">
                        <button type="button" @click="open = !open"
                            class="w-full flex justify-between items-center rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 py-2 px-3 text-left shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-800 dark:text-gray-200">
                            <span x-text="selectedValue"></span>
                            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        <div x-show="open" @click.away="open = false" x-cloak
                            class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 ring-1 ring-black ring-opacity-5 overflow-auto">
                            <template x-for="day in ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']" :key="day">
                                <a @click="selectedValue = day; open = false"
                                    class="block cursor-pointer px-3 py-2 text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    x-text="day"></a>
                            </template>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Mulai</label>
                        <input x-ref="waktu_mulai" type="text" name="waktu_mulai" placeholder="Pilih jam" required
                            class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Waktu Selesai</label>
                        <input x-ref="waktu_selesai" type="text" name="waktu_selesai" placeholder="Pilih jam" required
                            class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3">
                    </div>
                </div>
            </div>

            <!-- Tombol -->
            <div class="flex items-center gap-4 pt-4">
                <button type="submit"
                    class="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all">
                    Simpan Mata Kuliah
                </button>
                <a href="matakuliah.php"
                    class="w-full text-center bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                    Batal
                </a>
            </div>
        </form>
    </div>
</body>

</html>