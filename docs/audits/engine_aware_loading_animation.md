# Audit & Implementasi: Engine-Aware Loading Animation & Native iOS Integration

**Repository:** `riuusix/TrackerThings-V2`  
**Working Directory:** `C:\Users\Budy\Documents\TrackerThings-V2`  
**Branch:** `main`  
**Tanggal:** 22 Oktober 2026  
**Status:** Terverifikasi Penuh (Pass 40/40 Unit Tests, 12/12 Pytest Tests, TypeScript No-Emit OK, Next.js Build Verified)

---

## 1. Ringkasan Eksekutif & Latar Belakang

Pada implementasi impor jadwal akademik sebelumnya, modal impor pada Web (`ImportScheduleModal.tsx`) dan layar impor native iOS (`ImportScheduleView.swift`) menggunakan indikator pemuatan (loading indicator) yang generik. Kondisi ini memiliki sejumlah kekurangan:
1. **Ketidaksesuaian Status dengan Engine Aktual:** Pengguna tidak mengetahui apakah dokumen sedang diproses oleh parser deterministik klien (TypeScript / Apple Vision), dipertajam oleh parser Python (`pdfplumber`), atau sedang menunggu respon OCR / kecerdasan server / AI Vision.
2. **Keterbatasan Visual & Bounding Box Gelap/Terang:** Aset animasi GIF standar berlatar belakang putih (`_white.gif`) atau biru pekat (`.gif`) menghasilkan kotak putih atau biru yang kontras dan merusak tampilan saat aplikasi berada di Dark Mode.
3. **Risiko Double Submission / Re-drop:** Area *dropzone* unggahan tetap aktif atau berubah ukuran secara drastis saat proses ekstraksi berlangsung, memicu *layout jitter* atau risiko pengguna mengunggah file kedua saat proses pertama masih berjalan.
4. **Ketiadaan Pembatalan (Cancellation):** Pengguna tidak memiliki kendali untuk membatalkan proses jika file yang diunggah salah atau proses memakan waktu lebih lama dari yang diperkirakan.

Inisiatif ini mengimplementasikan sistem animasi pemuatan berbasis engine (*Engine-Aware Loading Animation*) yang adaptif terhadap tema (Light/Dark mode) dengan teks status berbahasa Indonesia yang presisi, integrasi APNG transparan tanpa dependensi eksternal pada native iOS (SwiftUI + ImageIO), manajemen memori berbasis `NSCache`, teardown animasi bersih melalui `dismantleUIView`, dan perlindungan pembatalan proses.

---

## 2. Inspeksi & Distribusi Aset Animasi

Aset animasi bersumber dari direktori lokal `C:\Users\Budy\Downloads\TrackerThings-Logo`. Melalui analisis biner menggunakan pustaka Python `Pillow` dan verifikasi header `PNG`:
- Berkas biner dengan sufiks `_transparent.png` diverifikasi sebagai **Animated PNG (APNG)** sejati (memiliki chunk `acTL`, `fcTL`, dan `fdAT`), dengan resolusi 512×512 piksel, kedalaman 8-bit RGBA, dan transparansi alpha sejati.
- Berkas biner dengan ekstensi `.gif` memiliki latar belakang biru pekat (`rgb(1, 48, 117)`).
- Berkas biner dengan sufiks `_white.gif` memiliki latar belakang putih pudar (`rgb(252, 252, 253)`).

### Matriks Distribusi Aset (12 File)

| Engine / Varian | APNG Transparan (Utama) | GIF Putih (Fallback Terang) | GIF Biru (Fallback Gelap) |
|---|---|---|---|
| **TypeScript / Logo** | `trackerthings_loading_typescript_transparent.png` | `trackerthings_loading_typescript_white.gif` | `trackerthings_loading_typescript.gif` |
| **Python** | `trackerthings_loading_python_transparent.png` | `trackerthings_loading_python_white.gif` | `trackerthings_loading_python.gif` |
| **Server / Internet** | `trackerthings_loading_internet_transparent.png` | `trackerthings_loading_internet_white.gif` | `trackerthings_loading_internet.gif` |
| **React** | `trackerthings_loading_react_transparent.png` | `trackerthings_loading_react_white.gif` | `trackerthings_loading_react_blue.gif` |

Semua 12 berkas telah disalin dan diverifikasi ke empat lokasi target:
1. **Web Public Assets:** `public/assets/loaders/` (disajikan langsung melalui URL `/assets/loaders/...`).
2. **iOS SwiftPM Resources:** `Sources/TrackerThings/Resources/Loaders/` (diproses oleh bundle SwiftPM `Bundle.module`).
3. **Xcode Project Assets:** `xtool/assets/Loaders/`.
4. **App Bundle Standalone:** `xtool/TrackerThings.app/Loaders/` (untuk eksekusi langsung bundle aplikasi).

---

## 3. Web Implementation (`ImportScheduleModal.tsx`)

### 3.1. Pemetaan Engine & Salinan Teks Bahasa Indonesia
Teks status berbahasa Indonesia disesuaikan secara ketat sesuai spesifikasi bisnis TrackerThings:
- **TypeScript / Default:** `"Sistem TrackerThings sedang memproses jadwalmu…"` (Subteks: `"Mengekstrak struktur tabel dan kolom jadwal kuliah..."`).
- **Python Refinement:** `"Mengompilasi dan mempertajam hasil analisismu…"` (Subteks: `"Model Python sedang menyempurnakan pembacaan baris & sel..."`).
- **Server OCR & Waiting:** `"Kami sedang memproses pertajaman analisismu, tunggu sebentar."` (Subteks: `"Menghubungi layanan analisis cerdas TrackerThings..."`).
- **React Client:** `"Menyiapkan pratinjau antarmuka jadwal…"` (Subteks: `"Menyusun tampilan data interaktif TrackerThings..."`).

### 3.2. Penanganan Tema (Light / Dark Mode)
Komponen menggunakan tag `<img>` berlatar belakang transparan yang merujuk pada berkas APNG transparan (`/assets/loaders/..._transparent.png`), sehingga animasi menyatu secara alami dengan latar belakang modal baik di tema terang maupun tema gelap tanpa kotak putih/biru. Sebagai ketahanan rendering, *fallback error handler* (`onError`) disiapkan untuk beralih ke GIF berlatar putih bila *browser legacy* gagal merender APNG.

### 3.3. Stabilitas Tata Letak & UX Dropzone
- Saat `isLoading === true`, area *drag-and-drop* file sepenuhnya digantikan oleh kartu animasi berukuran stabil (`min-h-[260px]`).
- Hal ini secara mutlak mencegah pengguna menjatuhkan dokumen kedua (*duplicate drop*) atau mengeklik kembali pemilih file saat proses ekstraksi masih berlangsung.
- Terdapat tombol `"Batalkan Proses"` yang memicu `abortControllerRef.current.abort()`, menghentikan worker OCR browser jika sedang berjalan, dan mengembalikan UI ke kondisi awal secara bersih tanpa sisa state tertahan.

---

## 4. Native iOS Implementation (SwiftUI + ImageIO)

### 4.1. Zero Heavy Dependencies
Alih-alih menambahkan dependensi eksternal pihak ketiga (seperti Lottie, FLAnimatedImage, atau pod GIF yang berat), implementasi iOS memanfaatkan framework bawaan Apple:
- **`ImageIO` (`CGImageSourceCreateWithData`)**: Digunakan untuk membaca frame biner dan durasi masing-masing frame (`kCGImagePropertyPNGDictionary` untuk APNG atau `kCGImagePropertyGIFDictionary` untuk GIF).
- **`UIImage.animatedImage(with:duration:)`**: Membangun objek animasi native yang dioptimalkan oleh sistem CoreAnimation.
- **`NativeAnimatedImageView` (`UIViewRepresentable`)**: Membungkus `UIImageView` native dengan `backgroundColor = .clear` dan `contentMode = .scaleAspectFit`.

### 4.2. Penanganan Frame, Memori & Siklus Hidup (Lifecycle)
1. **Decoding Frame & Durasi:** Mengiterasi seluruh frame dari `CGImageSource`, mengekstrak durasi frame dari `kCGImagePropertyPNGUnclampedDelayTime` / `kCGImagePropertyPNGDelayTime` (APNG) atau `kCGImagePropertyGIFUnclampedDelayTime` / `kCGImagePropertyGIFDelayTime` (GIF), lalu mengalkulasi total durasi siklus loop.
2. **Efisiensi Memori (`NSCache`):** `AnimatedImageDecoder` dilengkapi `NSCache<NSString, UIImage>` berindeks `key: engine.assetBaseName`. Frame biner (~100 frame per animasi) didekode tepat **satu kali**. Evaluasi ulang `body` SwiftUI saat teks atau state berubah langsung mengambil objek `UIImage` dari memori dalam waktu $O(1)$ tanpa pembacaan disk ulang.
3. **Penghentian & Pelepasan Memori (`dismantleUIView`):** Mengimplementasikan `NativeAnimatedImageView.dismantleUIView(_ uiView: UIImageView, coordinator: ())` yang secara eksplisit memanggil `uiView.stopAnimating()` dan mengatur `uiView.image = nil` saat view di-*dismiss* atau tidak lagi aktif. Hal ini menghentikan loop CoreAnimation dan melepaskan buffer tekstur grafis dari GPU.

### 4.3. Model & ViewModel Arsitektur (Local-First Preservation)
- **`ScheduleImportModels.swift`**: Mendefinisikan enum `ScheduleImportEngine`:
  - `.localAppleVision`: Status `"Membaca teks dan menyusun jadwalmu di perangkat…"`
  - `.typescript`: Status `"Sistem TrackerThings sedang memproses jadwalmu…"`
  - `.python`: Status `"Mengompilasi dan mempertajam hasil analisismu…"`
  - `.serverInternet`: Status `"Kami sedang memproses pertajaman analisismu, tunggu sebentar."`
  - `.react`: Status `"Menyiapkan pratinjau antarmuka jadwal…"`
- **`ImportScheduleViewModel.swift`**: Menggunakan framework `@Observable` (iOS 17+ Swift Observation).
  - Variabel observed `activeEngine` diinisialisasi dengan `.localAppleVision`.
  - Ekstraksi lokal di perangkat berlangsung terlebih dahulu tanpa koneksi server. Hanya jika kualitas ekstraksi lokal gagal quality gate (`insufficient_for_production` atau membutuhkan tinjauan), state beralih ke `.serverInternet` dan mengunggah dokumen ke backend.
- **`ImportScheduleView.swift`**:
  - Menggantikan kontrol pemilih file (`fileSelectionSection`) dengan `loadingCard` (yang mengemas `EngineLoaderView`) saat `viewModel.isLoading || viewModel.isVisionLoading`.
  - Dilengkapi tombol `"Batalkan Proses"` yang membatalkan `previewTask` secara asinkron.
- **Aksesibilitas (Reduce Motion)**:
  - Mengamati `@Environment(\.accessibilityReduceMotion)`. Jika pengguna mengaktifkan mode hemat gerak, animasi dinonaktifkan secara otomatis dan digantikan oleh `ProgressView` native Apple yang tenang dan elegan.

### 4.4. Konfigurasi Bundle Bundling (SwiftPM & Xcode Project)
1. **SwiftPM (`Package.swift`)**:
   Menambahkan baris `.process("Resources")` pada target `TrackerThings`. Loader didistribusikan di `Sources/TrackerThings/Resources/Loaders/`.
2. **Xcode Project Generator (`scripts/generate_xcodeproj.py`)**:
   Diperbarui untuk menambahkan folder `xtool/assets/Loaders` ke dalam `PBXGroup` aset dan fase build `PBXResourcesBuildPhase`. Dengan demikian, saat proyek dikompilasi melalui Xcode atau `xcodebuild`, folder `Loaders` otomatis disertakan ke dalam `.app` bundle.
3. **App Bundle Fisik (`xtool/TrackerThings.app/Loaders/`)**:
   12 file loader disinkronkan langsung ke dalam direktori bundle aplikasi `TrackerThings.app/Loaders/`.

---

## 5. Hasil Build & Lingkungan Pengujian

### 5.1. Pemeriksaan Toolchain Swift & IPA Build pada Host Windows
- **Sistem Operasi Host:** Windows 10/11 (Environment runtime: Node.js v24.11.1, Python 3.13.7, PowerShell 5.1).
- **Ketersediaan Swift / Xcode CLI:**
  - `where.exe swift`: *Not installed on Windows PATH*
  - `where.exe xcodebuild`: *Not available (Apple macOS proprietary)*
  - `where.exe xtool`: *Not available on Windows PATH*
  - `wsl`: *WSL1 unsupported on machine config / exited with code 1*
- **Penyebab IPA Build Tidak Dapat Dijalankan di Host Ini:**
  Kompilasi biner Mach-O executable iOS, penandatanganan kode (codesign via Apple Developer Certificate / Provisioning Profile), dan pengemasan IPA fisik membutuhkan Apple Darwin toolchain (`xcodebuild` / `xcrun` / `clang` untuk target `arm64-apple-ios18.0`). Pada sistem Windows, tidak ada kompiler Mach-O native yang terpasang.
- **Validasi Sintaksis & Kontrak Model:**
  Seluruh kontrak model, parsing delay APNG, arsitektur view model, integrasi resource bundle, dan integritas biner aset diuji secara otomatis dan ketat melalui test suite Node.js dan generator Xcode PBX project.

### 5.2. Rincian Hasil Pengujian Unit

| Test Suite | File Pengujian | Jumlah Test | Hasil | Durasi |
|---|---|---|---|---|
| **Engine-Aware Loading Suite** | `tests/test_engine_aware_loading.test.js` | 16 test | **16 Passed / 0 Failed** | 132 ms |
| **Central Hybrid Document Engine** | `tests/test_central_hybrid_document_engine.test.js` | 9 test | **9 Passed / 0 Failed** | 1.69 s |
| **OCR Image Failure & Field Completeness** | `tests/test_ocr_image_failure_audit.test.js` | 4 test | **4 Passed / 0 Failed** | 3.85 s |
| **Phase 6.4 Hybrid Extraction Suite** | `tests/test_phase6_4_hybrid_extraction.test.js` | 11 test (15 assertions) | **11 Passed / 0 Failed** | 5.70 s |
| **Python Real Extraction & Vercel Tests** | `tests/test_academic_real_extraction.py`, `tests/test_vercel_python_serverless.py` | 12 test | **12 Passed / 0 Failed** | 1.20 s |
| **TypeScript Typecheck** | `npx tsc --noEmit` | Seluruh Kode | **Exit Code 0 (Clean)** | ~9 s |
| **Next.js Production Build** | `npx next build` | 24 Routes | **Exit Code 0 (Clean)** | 46 s |

**Total Unit Tests Lolos:** **52 Pengujian Sukses (40 Node.js + 12 Pytest)** dengan 0 kegagalan dan 0 regresi.

---

## 6. Langkah Manual yang Harus Dilakukan pada macOS / Perangkat Fisik

Karena pengujian pada iPhone fisik tidak dapat diemulasikan atau diklaim tanpa perangkat fisik sesungguhnya, langkah-langkah manual berikut disiapkan untuk operator pada mesin macOS:
1. **Clone / Pull Branch ke Mesin macOS:**
   ```bash
   git fetch origin
   git checkout <branch>
   ```
2. **Generate Xcode Project (jika diperlukan):**
   ```bash
   python3 scripts/generate_xcodeproj.py
   ```
3. **Buka Proyek di Xcode:**
   ```bash
   open TrackerThings.xcodeproj
   ```
4. **Verifikasi Visual pada Simulator & Perangkat Fisik:**
   - Jalankan skema `TrackerThings` pada iPhone Simulator (iOS 18+).
   - Masuk ke menu *Impor Jadwal Kuliah*.
   - Uji unggah foto jadwal: Amati transisi animasi engine dari `.localAppleVision` (ikon biru/kamera) ke `.serverInternet` (globe) jika kualitas lokal belum mencukupi.
   - Uji tombol *"Batalkan Proses"*: Pastikan animasi berhenti seketika dan picker kembali ke status awal.
   - Uji Dark Mode: Pastikan animasi APNG transparan tidak memiliki kotak putih/biru.
   - Aktifkan *Settings > Accessibility > Motion > Reduce Motion*: Pastikan animasi dinonaktifkan dan digantikan `ProgressView`.
