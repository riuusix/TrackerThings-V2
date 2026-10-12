# Database Changelog — TrackerThings V2

Dokumen ini mencatat riwayat perubahan skema, arsitektur akses database, dan evolusi kebijakan keamanan pada TrackerThings V2.

---

## [2.3.0] - 2026-10-12
### Pelaksanaan Remediasi Keamanan & Migrasi Total ke Server-Side Prisma (Stage A)
- **Eliminasi 100% Penggunaan PostgREST Client pada Tabel Sensitif**:
  - Seluruh Server Actions (`app/actions/auth.ts`, `app/actions/jadwal.ts`, `app/actions/tugas.ts`, `app/actions/ujian.ts`, `app/actions/kelasPengganti.ts`) dimigrasikan dari Supabase PostgREST client ke Prisma ORM dengan verifikasi hak milik pengguna (`userId: session.userId`).
  - Seluruh API Routes (`app/api/auth/*`, `app/api/jadwal/*`, `app/api/tugas/*`, `app/api/ujian/*`, `app/api/kelas-pengganti/*`, `app/api/user/*`, `app/api/profile/*`, `app/api/admin/*`) dimigrasikan ke Prisma ORM dengan penegakan isolasi data pengguna yang ketat.
  - Seluruh React Server Components (`app/dashboard/page.tsx`, `app/matakuliah/page.tsx`, `app/history/page.tsx`, `app/ujian/page.tsx`, `app/profile/page.tsx`, `app/settings/page.tsx`, `app/admin/users/page.tsx`, `app/admin/announcements/page.tsx`) dimigrasikan dari query Supabase anon yang tidak terisolasi ke query Prisma yang terisolasi per `session.userId`.
  - Pemindaian otomatis 57 file aplikasi mengonfirmasi 0 query `.from()` PostgREST pada tabel sensitif.
- **Sinkronisasi Skema Prisma dengan Kolom Aktual Cloud**:
  - Menambahkan kolom `role String @default("user")` dan `sks Int?` yang ada pada PostgreSQL Supabase.
  - Menghapus kolom fiktif `created_at` dari model `Jadwal`, `Tugas`, dan `Ujian` di `prisma/schema.prisma` yang sebelumnya memicu error PostgreSQL P2022.
  - Memberikan fallback aman `new Date().toISOString()` untuk mempertahankan kompatibilitas kontrak Swift Codable pada aplikasi iOS.
- **Verifikasi Build & Test**:
  - `npm run build` sukses dengan kode 0 (23 static/dynamic routes terkompilasi).
  - `npm test` sukses 31/31 pengujian endpoint API dan middleware auth.
- **Penyusunan Script Hardening Database (Stage B)**:
  - Menyusun panduan DDL SQL di `docs/database/REMEDIATION_SQL.md` untuk dieksekusi melalui Supabase Dashboard SQL Editor.

---

## [2.2.0] - 2026-10-12
### Audit Skema Cloud & Verifikasi RLS (Full Supabase Migration - Fase 2)
- **Introspeksi Read-Only Database Supabase Cloud**:
  - Memverifikasi keberadaan 8 tabel di skema `public`: 5 tabel inti (`users`, `jadwal`, `tugas`, `ujian`, `kelas_pengganti`) serta 3 tabel sistem (`announcements`, `settings`, `admin_logs`).
  - Mengidentifikasi divergensi kolom: `jadwal.sks` (integer), `users.role`, `users.new_password_hash`, `users.reset_token`, `users.token_expires_at` belum terpetakan di `prisma/schema.prisma`.
  - Mengonfirmasi keberadaan skema `auth.users` untuk migrasi Supabase Auth.
- **Audit Definitif Kebijakan RLS Cloud**:
  - Menemukan bahwa seluruh 5 tabel operasional (`users`, `jadwal`, `tugas`, `ujian`, `kelas_pengganti`) memiliki policy permisif `Allow all on ...` (qual: `true`, with_check: `true`) untuk role `public`.
  - Mengonfirmasi bahwa tabel `admin_logs`, `announcements`, dan `settings` berada dalam status default RLS deny (tidak ada policy terbuka).

---

## [2.1.0] - 2026-10-12
### Keamanan & Arsitektur (Authentication Hardening)
- **Migrasi Verifikasi Kredensial ke Prisma**:
  - Mengalihkan pencarian akun pada `loginAction` ([`app/actions/auth.ts`](file:///C:/Users/Budy/Documents/TrackerThings-V2/app/actions/auth.ts)) dan REST API login iOS ([`app/api/auth/login/route.ts`](file:///C:/Users/Budy/Documents/TrackerThings-V2/app/api/auth/login/route.ts)) dari Supabase PostgREST (`anon key`) ke Prisma ORM (`prisma.user.findUnique`).
  - Mencegah kebutuhan membuka akses publik `SELECT` pada tabel `users` untuk role `anon` di PostgREST API (mitigasi CWE-200).
- **Field Selection Eksplisit**:
  - Membatasi field yang diambil dari database hanya field yang benar-benar dibutuhkan (`id`, `username`, `email`, `password`, dan metadata profil).
  - Menghilangkan pembacaan liar kolom password hash atau security answer hash pada respons API dan log server.
- **Pemisahan Error Database**:
  - Mengisolasi penanganan exception koneksi database/Prisma dari kegagalan pencocokan kredensial pengguna.
- **Dokumentasi Sistem Database**:
  - Pembuatan sistem dokumentasi database terpisah di direktori `docs/database/` (`README.md`, `SCHEMA.md`, `POLICIES.md`, `CHANGELOG.md`, `CHANGE_TEMPLATE.md`).

---

## [2.0.0] - 2026-10-11
### Migrasi Arsitektur (Legacy PHP ke Next.js & Prisma)
- **Skema Database Relasional PostgreSQL**:
  - Pembuatan skema PostgreSQL terpadu via `prisma/schema.prisma` menggantikan skema MySQL PHP legacy.
  - Pemetaan tabel:
    - `users` (model `User`)
    - `jadwal` (model `Jadwal`)
    - `tugas` (model `Tugas`)
    - `ujian` (model `Ujian`)
    - `kelas_pengganti` (model `KelasPengganti`)
- **Foreign Key Cascading**:
  - Penerapan `ON DELETE CASCADE` pada seluruh tabel anak yang berelasi ke `users(id)` dan `jadwal(id)`.
- **Integrasi Supabase & Prisma**:
  - Integrasi koneksi Prisma via `DATABASE_URL` untuk orkestrasi skema.
  - Penambahan klien `@supabase/ssr` untuk operasi data pengguna.

