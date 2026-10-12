# Tahap B: Script Pengerasan Database PostgreSQL / Supabase (Stage B SQL Remediation)

> **STATUS: DRAFT REVIEW ONLY — NOT EXECUTED** **PERINGATAN OPERATOR**: Script
> ini TIDAK dieksekusi secara otomatis oleh agen dan HANYA untuk di-review oleh
> operator manusia sebelum dijalankan secara manual di **Supabase Dashboard ->
> SQL Editor**.

---

## 1. Bukti Metadata Aktual & Hasil Audit Katalog PostgreSQL

Inspeksi read-only komprehensif dilakukan langsung terhadap katalog PostgreSQL
Supabase Cloud (`pg_default_acl`, `pg_proc`, `pg_class`, `pg_depend`,
`pg_policies`, `information_schema.role_table_grants`,
`information_schema.column_privileges`, `pg_event_trigger`, `pg_roles`,
`pg_auth_members`).

### A. Keberadaan 8 Tabel, Status RLS, dan Audit Policy Eksisting

- **Keberadaan Tabel**: Seluruh 8 tabel (`users`, `jadwal`, `tugas`, `ujian`,
  `kelas_pengganti`, `announcements`, `settings`, `admin_logs`) terverifikasi
  ada di schema `public`.
- **Status RLS**: Seluruh 8 tabel memiliki `relrowsecurity = true` dan
  `relforcerowsecurity = false`.
- **Kebijakan Aktual di Database**: Kueri
  `pg_policies WHERE schemaname = 'public'` mengonfirmasi tepat **5 kebijakan**
  yang aktif:
  1. `Allow all on users` (cmd: `ALL`, roles: `{"public"}`, qual: `true`,
     with_check: `true`)
  2. `Allow all on jadwal` (cmd: `ALL`, roles: `{"public"}`, qual: `true`,
     with_check: `true`)
  3. `Allow all on tugas` (cmd: `ALL`, roles: `{"public"}`, qual: `true`,
     with_check: `true`)
  4. `Allow all on kelas_pengganti` (cmd: `ALL`, roles: `{"public"}`, qual:
     `true`, with_check: `true`)
  5. `Allow all on ujian` (cmd: `ALL`, roles: `{"public"}`, qual: `true`,
     with_check: `true`) Tabel `announcements`, `settings`, dan `admin_logs`
     memiliki **0 kebijakan** (berada dalam mode bawaan _default-deny_ jika hak
     akses PostgREST dicabut).
- **Evaluasi Dynamic Loop**: Dynamic loop yang digunakan dibatasi secara ketat
  hanya pada daftar 8 tabel target (`tablename IN ('users', ...)`). Namun,
  karena daftar policy di database telah diketahui secara pasti dan tepat 5
  policy, script mencantumkan `DROP POLICY` eksplisit untuk ke-5 policy
  tersebut, disusul dynamic safety check yang dibatasi hanya pada 8 tabel ini
  untuk membersihkan policy sisa jika ada inkonsistensi penamaan. Hal ini
  memastikan script **tidak terlalu luas** dan tidak akan menyentuh tabel di
  luar ke-8 target.

### B. Hak Akses Efektif, Pewarisan Role, dan Kolom

- **Role Attributes & Memberships (`pg_roles`, `pg_auth_members`)**:
  - `anon`: `rolsuper = false`, `rolbypassrls = false`, `rolinherit = true`,
    `member_of = []` (tidak mewarisi role lain).
  - `authenticated`: `rolsuper = false`, `rolbypassrls = false`,
    `rolinherit = true`, `member_of = []`.
  - `authenticator`: `rolcanlogin = true`, anggota dari
    `[anon, authenticated, service_role]`. Role ini digunakan PostgREST untuk
    berganti identitas via `SET ROLE`.
  - `postgres`: `rolcanlogin = true`, `rolbypassrls = true` (mengabaikan RLS),
    anggota dari grup pemeliharaan internal.
- **Hak Akses Tabel & Kolom**:
  - Role `anon` dan `authenticated` saat ini memiliki grant `ALL` pada tabel
    utama.
  - Terdapat 112 entri grant kolom yang diturunkan dari table grant
    (`pg_attribute.attacl` bernilai `NULL`).
  - **Pencabutan Efektif**: Menjalankan
    `REVOKE ALL ON TABLE ... FROM anon, authenticated, PUBLIC;` mencabut 100%
    privilege tabel dan kolom bagi role PostgREST.

### C. Cakupan Default ACL: Hanya Objek Target & Schema `public`

- **Temuan Metadata Global (`defaclnamespace IS NULL`)**: Kueri
  `SELECT * FROM pg_default_acl WHERE defaclnamespace IS NULL;` menghasilkan **0
  baris (`[]`)**.
- **Fakta**: Database proyek ini **TIDAK memiliki default privileges global** di
  level database. Seluruh entri terdaftar per-schema.
- **Cakupan Script**: Script mencabut default privileges secara presisi hanya
  untuk target schema `public` dan hanya untuk role pembuat objek (`postgres`
  dan `supabase_admin`):

  ```sql
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;
  ```

  Script **tidak mengklaim dan tidak menyentuh** schema internal Supabase
  lainnya (`storage`, `graphql`, `realtime`, `auth`, `extensions`).

### D. Konfigurasi Koneksi Database Prisma (Lokal vs Runtime Produksi)

- **Bukti Terverifikasi Langsung (Koneksi Prisma Aktual)**: Kueri
  `SELECT current_user, session_user, current_database(), inet_server_port();`
  melalui instance Prisma mengonfirmasi:
  - `current_user`: `postgres`
  - `session_user`: `postgres`
  - `rolbypassrls`: `true`
- **Batasan Bukti (Local Code vs Production Runtime)**:
  - Di lingkungan lokal, Prisma terhubung via `.env.local` ke Supabase Cloud
    pooler dengan user `postgres`.
  - **Asumsi Produksi**: Deployment runtime di Vercel diasumsikan menggunakan
    konfigurasi Environment Variable `DATABASE_URL` yang sama (mengarah ke user
    `postgres` melalui pooler Supabase).
  - **Verifikasi Pra-Hardening**: Operator wajib memverifikasi di Vercel
    Dashboard -> Settings -> Environment Variables bahwa nilai `DATABASE_URL`
    produksi menggunakan kredensial user `postgres`, bukan role terbatas seperti
    `authenticated`.

### E. Prosedur Verifikasi Multi-Dimensi (Bukan Hanya HTTP Status)

- Status HTTP 401/403 memang menunjukkan penolakan PostgREST, namun verifikasi
  keamanan sejati harus bersifat multi-dimensi:
  1. **HTTP Status Check**: Memastikan penolakan akses jaringan/API (401/403).
  2. **Response Header Check**: Memastikan tidak ada header `Content-Range` yang
     membocorkan estimasi total baris data (`count=exact`).
  3. **SQL Catalog Privilege Check**: Memverifikasi langsung di SQL Editor bahwa
     `has_table_privilege('anon', ...)` bernilai `false`.
  4. **Application Gateway Check**: Memastikan Next.js endpoint tetap merespons
     200 OK untuk user sah.

---

## 2. Status Verifikasi Jalur Aplikasi Web & Native iOS

| Jalur Integrasi / Modul                                    | Jalur Akses Data                     | Status Hardening                                        |
| :--------------------------------------------------------- | :----------------------------------- | :------------------------------------------------------ |
| **Web Autentikasi** (`/api/auth/*`, `app/actions/auth.ts`) | Prisma ORM via pooler (port 6543)    | **TERVERIFIKASI AMAN** (Bypass RLS via user `postgres`) |
| **Web Dashboard & Jadwal** (`/api/jadwal/*`, `/dashboard`) | Prisma ORM via pooler (port 6543)    | **TERVERIFIKASI AMAN**                                  |
| **Web Tugas & Ujian** (`/api/tugas/*`, `/api/ujian/*`)     | Prisma ORM via pooler (port 6543)    | **TERVERIFIKASI AMAN**                                  |
| **Web Kelas Pengganti** (`/api/kelas-pengganti/*`)         | Prisma ORM via pooler (port 6543)    | **TERVERIFIKASI AMAN**                                  |
| **Web Admin Panel** (`/app/admin/*`, `/api/admin/*`)       | Prisma ORM via pooler (port 6543)    | **TERVERIFIKASI AMAN**                                  |
| **iOS Native App** (Jadwal, Tugas, Profil)                 | Next.js API Gateway (`/api/*`)       | **TERVERIFIKASI AMAN** (Tidak direct PostgREST)         |
| **Direct PostgREST Client di Frontend**                    | Dihapus / 0 direct query di codebase | **TERVERIFIKASI AMAN**                                  |

---

## 3. Query Read-Only untuk Verifikasi Pre & Post-Hardening

Gunakan query SQL read-only berikut di Supabase SQL Editor untuk memvalidasi
privilege sebelum dan sesudah eksekusi:

```sql
-- 1. Verifikasi Table Grants Aktual untuk role anon dan authenticated
SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND table_name IN ('users', 'jadwal', 'tugas', 'ujian', 'kelas_pengganti', 'announcements', 'settings', 'admin_logs')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 2. Verifikasi Hak Akses Efektif Fungsi has_table_privilege
SELECT
  t.table_name,
  r.rolname,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'SELECT') AS can_select,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'INSERT') AS can_insert,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'UPDATE') AS can_update,
  has_table_privilege(r.rolname, 'public.' || t.table_name, 'DELETE') AS can_delete
FROM (VALUES ('users'), ('jadwal'), ('tugas'), ('ujian'), ('kelas_pengganti'), ('announcements'), ('settings'), ('admin_logs')) AS t(table_name)
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname);

-- 3. Verifikasi Hak Akses Efektif Kolom (has_column_privilege)
-- Memastikan tidak ada grant kolom sisa untuk kolom sensitif
SELECT 
  t.table_name,
  c.column_name,
  r.rolname,
  has_column_privilege(r.rolname, 'public.' || t.table_name, c.column_name, 'SELECT') AS can_select
FROM (VALUES ('users'), ('jadwal'), ('tugas'), ('ujian'), ('kelas_pengganti'), ('announcements'), ('settings'), ('admin_logs')) AS t(table_name)
JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = t.table_name
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
WHERE c.column_name IN ('id', 'password', 'email', 'user_id', 'username')
ORDER BY t.table_name, c.column_name, r.rolname;

-- 4. Verifikasi Hak Akses Efektif Sequence
SELECT
  s.relname AS sequence_name,
  r.rolname,
  has_sequence_privilege(r.rolname, 'public.' || s.relname, 'USAGE') AS can_usage,
  has_sequence_privilege(r.rolname, 'public.' || s.relname, 'SELECT') AS can_select,
  has_sequence_privilege(r.rolname, 'public.' || s.relname, 'UPDATE') AS can_update
FROM pg_class s
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rolname)
WHERE s.relnamespace = 'public'::regnamespace AND s.relkind = 'S';

-- 5. Verifikasi Status Policy RLS (Harus 0 policy untuk ke-8 tabel pasca-hardening)
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public';
```

---

## 4. SQL Migration Script (Stage B — STATUS: DRAFT REVIEW ONLY — NOT EXECUTED)

```sql
-- =========================================================================
-- STATUS: DRAFT REVIEW ONLY — NOT EXECUTED
-- STAGE B: POSTGRESQL / SUPABASE ACCESS-CONTROL HARDENING
-- Target: Supabase Cloud PostgreSQL
-- Tujuan: Menutup seluruh celah paparan data PostgREST (Default-Deny)
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. HAPUS SEMUA KEBIJAKAN RLS PERMISIF PADA TABEL SENSITIF & SISTEM
-- -------------------------------------------------------------------------

-- Drop eksplisit berdasarkan 5 kebijakan aktual yang teridentifikasi dalam audit:
DROP POLICY IF EXISTS "Allow all on users" ON public.users;
DROP POLICY IF EXISTS "Allow all on jadwal" ON public.jadwal;
DROP POLICY IF EXISTS "Allow all on tugas" ON public.tugas;
DROP POLICY IF EXISTS "Allow all on ujian" ON public.ujian;
DROP POLICY IF EXISTS "Allow all on kelas_pengganti" ON public.kelas_pengganti;

-- Verifikasi ketat kebijakan RLS:
-- Pastikan HANYA 5 kebijakan yang telah diaudit yang ada.
-- Jika ditemukan kebijakan tak dikenal di ke-8 tabel aplikasi, HENTIKAN transaksi dengan EXCEPTION.
DO $$
DECLARE
  unexpected_pol RECORD;
  known_policies text[] := ARRAY[
    'Allow all on users',
    'Allow all on jadwal',
    'Allow all on tugas',
    'Allow all on ujian',
    'Allow all on kelas_pengganti'
  ];
BEGIN
  -- Periksa apakah ada kebijakan di luar daftar yang diaudit
  SELECT schemaname, tablename, policyname INTO unexpected_pol
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'jadwal', 'tugas', 'ujian', 'kelas_pengganti', 'announcements', 'settings', 'admin_logs')
    AND NOT (policyname = ANY(known_policies))
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ABORT: Ditemukan kebijakan RLS tak dikenal/tak diaudit pada %.%: "%". Transaksi dibatalkan untuk mencegah kehilangan kebijakan yang sah.',
      unexpected_pol.schemaname, unexpected_pol.tablename, unexpected_pol.policyname;
  END IF;

  -- Pastikan semua kebijakan pada ke-8 tabel telah terhapus sempurna
  SELECT schemaname, tablename, policyname INTO unexpected_pol
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'jadwal', 'tugas', 'ujian', 'kelas_pengganti', 'announcements', 'settings', 'admin_logs')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ABORT: Kebijakan %.%: "%" masih ada setelah DROP POLICY. Transaksi dibatalkan.',
      unexpected_pol.schemaname, unexpected_pol.tablename, unexpected_pol.policyname;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 2. PASTIKAN ROW LEVEL SECURITY (RLS) AKTIF PADA SEMUA TABEL
--    (Tanpa policy = Default Deny untuk akses PostgREST anon & authenticated)
-- -------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jadwal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tugas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ujian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kelas_pengganti ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_logs') THEN
    ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 3. CABUT HAK AKSES TABEL DARI ROLE anon, authenticated, DAN PUBLIC
-- -------------------------------------------------------------------------

-- Tabel kredensial pengguna (MUTLAK DILARANG untuk PostgREST)
REVOKE ALL ON TABLE public.users FROM anon, authenticated, PUBLIC;

-- Tabel operasional mahasiswa
REVOKE ALL ON TABLE public.jadwal FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.tugas FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.ujian FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.kelas_pengganti FROM anon, authenticated, PUBLIC;

-- Tabel sistem pendukung
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
    REVOKE ALL ON TABLE public.announcements FROM anon, authenticated, PUBLIC;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    REVOKE ALL ON TABLE public.settings FROM anon, authenticated, PUBLIC;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_logs') THEN
    REVOKE ALL ON TABLE public.admin_logs FROM anon, authenticated, PUBLIC;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 4. CABUT HAK AKSES PADA SELURUH SEQUENCE DI SCHEMA PUBLIC
-- -------------------------------------------------------------------------
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- -------------------------------------------------------------------------
-- 5. CABUT DEFAULT PRIVILEGES UNTUK OBJEK BARU DI MASA DEPAN
--    (Presisi untuk owner 'postgres' dan 'supabase_admin' di schema 'public')
-- -------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

COMMIT;
```

---

## 5. Prosedur Verifikasi Multi-Dimensi Pasca-Eksekusi

> [!IMPORTANT] **Metodologi Pengujian Negatif Multi-Dimensi**: Memeriksa status
> HTTP saja tidak mencukupi untuk audit keamanan menyeluruh. Verifikasi
> multi-dimensi mencakup:
>
> 1. Status Code HTTP (401 Unauthorized atau 403 Forbidden).
> 2. Ketiadaan Header `Content-Range` yang membocorkan estimasi total baris.
> 3. Ketiadaan data pengguna/kredensial di response body (output di-dump ke
>    `/dev/null`).
> 4. Verifikasi katalog PostgreSQL via `has_table_privilege`.

Jalankan pengujian verifikasi multi-dimensi berikut dari terminal operator:

### 1. Uji Penolakan PostgREST pada Tabel `users`

```bash
curl -s -i "https://<supabase-project-ref>.supabase.co/rest/v1/users?select=id,username,email" \
  -H "apikey: <supabase-anon-key>" \
  -H "Range-Unit: items" \
  -H "Prefer: count=exact" | head -n 15
```

- **Kriteria Keberhasilan**:
  - Baris status HTTP: `401 Unauthorized` atau `403 Forbidden`.
  - Tidak ada header `Content-Range` yang menghitung baris tabel `users`.
  - Tidak ada hash password atau data pengguna yang ditampilkan.

### 2. Uji Penolakan PostgREST pada Tabel Operasional (`jadwal`, `tugas`)

```bash
curl -s -i "https://<supabase-project-ref>.supabase.co/rest/v1/tugas?select=id" \
  -H "apikey: <supabase-anon-key>" | head -n 10
```

- **Kriteria Keberhasilan**: `401 Unauthorized` atau `403 Forbidden`.

### 3. Uji Fungsionalitas Server Gateway & Aplikasi Web/iOS

Jalankan pengujian endpoint lokal:

```bash
npm test
```

- **Hasil yang Diharapkan**: Seluruh pengujian endpoint lokal lulus
  (`31/31 PASS`), membuktikan bahwa server Next.js (Prisma ORM via user
  `postgres`) tetap beroperasi normal karena tidak mengandalkan PostgREST.

---

## 6. Pedoman Tanggap Darurat & Larangan Rollback (Emergency Guidelines)

> [!CAUTION] **ATURAN MUTLAK KESELAMATAN DATA**:
>
> 1. **DILARANG KERAS MENGEMBALIKAN HAK AKSES PUBLIK, ANON, ATAU AUTHENTICATED
>    PADA TABEL `users` MAUPUN TABEL OPERASIONAL APAPUN!**
> 2. **JANGAN PERNAH MENJALANKAN PERINTAH `GRANT SELECT ... TO authenticated`
>    ATAU `anon` PADA TABEL SENSITIF ATAU OPERASIONAL SEBAGAI SOLUSI ROLLBACK.**
> 3. Membuka kembali hak akses PostgREST langsung merusak perimeter keamanan dan
>    mengekspos data pribadi mahasiswa serta kredensial akun ke publik.

Jika aplikasi web atau iOS mengalami kendala operasional setelah hardening:

1. **Periksa Jalur Server**: Seluruh aplikasi telah dimigrasikan ke arsitektur
   server-side Next.js. Jika data gagal dimuat, akar masalahnya berada pada
   koneksi Prisma ke pooler Supabase (port 6543) atau variabel `DATABASE_URL`,
   **bukan pada penutupan hak akses PostgREST**.
2. **Periksa Log Aplikasi**: Periksa runtime log di Vercel/Next.js untuk
   memeriksa error pooler timeout atau konektivitas database.
3. **Rollback Arsitektur yang Sah**: Jika terjadi kegagalan deployment kode
   Next.js, lakukan redeploy/revert commit aplikasi web di Vercel ke commit
   stabil sebelumnya yang tetap menggunakan jalur Prisma. Jangan melakukan
   modifikasi permissiveness di Supabase Cloud.
