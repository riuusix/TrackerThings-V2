# Versioning & Release Management Policy — TrackerThings V2

Dokumen ini mendefinisikan kebijakan penomoran versi (Semantic Versioning), keterlacakan build (*build traceability*), serta manajemen rilis lintas platform (Web dan iOS) pada repositori TrackerThings V2.

---

## 1. Baseline Versi Aktif

Berdasarkan audit repositori aktual:
* **Web (Next.js)**: Versi produk dimulai dari **`2.0.0`** (dideklarasikan pada [`package.json`](../../package.json)).
* **Native iOS (SwiftUI)**: Versi pemasaran (*Marketing Version*) dimulai dari **`1.0.0`** (dideklarasikan pada [`xtool/assets/Info.plist`](../../xtool/assets/Info.plist) dan [`project.pbxproj`](../../TrackerThings.xcodeproj/project.pbxproj)).
* **Keterangan Phase 8 / Academic Intelligence**: Label "Phase 8" atau "0.8" adalah **tahapan roadmap arsitektural**, BUKAN nomor versi rilis semantik. Nomor versi tidak pernah diturunkan ke `0.8.0` untuk mencegah regresi SemVer.

---

## 2. Kebijakan Semantic Versioning (SemVer)

Pembaruan versi mengikuti format `MAJOR.MINOR.PATCH`:

1. **PATCH (x.y.Z)**:
   * Perbaikan bug kompatibel ke belakang (*backward-compatible*).
   * Contoh: Perbaikan parsing tanggal kalender, penanganan error 422 terstruktur, styling CSS.
2. **MINOR (x.Y.0)**:
   * Penambahan fitur baru yang tetap kompatibel ke belakang.
   * Contoh: Rilis modul *Academic Intelligence* (M1/M2), endpoint baru baca-saja (`GET /api/intelligence`), penambahan visual insight.
3. **MAJOR (X.0.0)**:
   * Perubahan kontrak API yang bersifat *breaking change* atau arsitektur menyeluruh.
   * Contoh: Pemutusan dukungan skema API lama yang mewajibkan update klien secara paksa.

---

## 3. Konvensi Tag Git & Pemisahan Siklus Rilis

Karena siklus rilis Web (Vercel CD) dan iOS (App Store / TestFlight review) memiliki kecepatan berbeda, rilis git diberi awalan (*prefix*) platform:

| Platform | Format Tag Git | Contoh Tag | Sumber Deklarasi |
| :--- | :--- | :--- | :--- |
| **Web** | `web-v<MAJOR>.<MINOR>.<PATCH>` | `web-v2.0.0`, `web-v2.1.0` | `package.json` |
| **iOS** | `ios-v<MAJOR>.<MINOR>.<PATCH>` | `ios-v1.0.0`, `ios-v1.1.0` | `Info.plist` & `project.pbxproj` |

> [!IMPORTANT]
> Tag baseline pertama (`web-v2.0.0` dan `ios-v1.0.0`) ditandai pada commit stabil `e5911c3` setelah tinjauan pengguna disetujui. Tag git lokal dan remote **tidak dibuat otomatis**.

---

## 4. Keterlacakan Build iOS (*Source Traceability*)

Pada workflow CI GitHub Actions ([`.github/workflows/build-ipa.yml`](../../.github/workflows/build-ipa.yml)):
1. **Dynamic Build Number**: Nilai `CFBundleVersion` dan `CURRENT_PROJECT_VERSION` secara otomatis diinjeksi dengan nomor urut eksekusi CI (`${{ github.run_number }}`).
2. **Commit Traceability**: Commit SHA disuntikkan ke dalam log build dan disematkan langsung pada penamaan file artifact `.ipa`:
   ```text
   TrackerThings-iOS-v1.0.0-build<RUN_NUMBER>-<COMMIT_SHA>.ipa
   ```
3. Hal ini memungkinkan tester QA dan pengembang melacak secara pasti commit mana yang menghasilkan biner aplikasi tertentu tanpa menebak-nebak.

---

## 5. Validasi Otomatis (Web CI)

Setiap pull request dan push ke branch `main` divalidasi oleh [`.github/workflows/web-ci.yml`](../../.github/workflows/web-ci.yml) yang mencakup:
* Pemeriksaan tipe statis: `npx tsc --noEmit`
* Validasi regresi tanggal kalender: `node tests/date_timezone_audit.test.js` & `node --test tests/test_timezone_regression.test.js`
* Validasi ketahanan konektivitas & arsitektur: `node --test tests/test_404_and_connectivity_resilience.test.js`
* Validasi import & error fallback: `node --test tests/test_phase7e_production_reliability.test.js`
* Uji parser benchmark: `node --test tests/test_schedule_benchmark.test.js`
* Validasi avatar upload & storage: `node --test tests/test_avatar_upload_integration.test.js`
* Pembuatan bundle produksi: `npm run build`
