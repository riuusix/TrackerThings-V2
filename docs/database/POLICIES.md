# Kebijakan Keamanan & Row Level Security (RLS) — TrackerThings V2

Dokumen ini mendokumentasikan kebijakan Row Level Security (RLS), hak akses peran (*grants*), dan evaluasi keamanan akses data pada TrackerThings V2.

---

## 1. Prinsip Keamanan & Isolasi Role `anon`

1. **Role Publik `anon`**:
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` adalah kunci publik yang disertakan pada klien web dan aplikasi iOS. Seluruh request PostgREST yang membawa kunci ini dievaluasi oleh PostgreSQL di bawah role `anon`.
2. **Isolasi Mutlak Tabel `users`**:
   - Tabel `users` menyimpan hash password Bcrypt (`password`), email, dan hash jawaban keamanan (`security_answer_hash`).
   - Role `anon` **dilarang keras** memiliki izin `SELECT` terhadap tabel `users`.
   - Jika role `anon` diberi izin membaca tabel `users`, penyerang eksternal dapat mengekstraksi seluruh kredensial database via endpoint REST PostgREST publik (**CWE-200: Information Exposure**).
3. **Mitigasi Melalui Trusted Server (Prisma)**:
   - Verifikasi kredensial saat login dialihkan 100% ke Prisma ORM melalui koneksi langsung `DATABASE_URL`.
   - PostgREST tidak lagi digunakan untuk autentikasi kredensial pengguna, sehingga tabel `users` dapat dilindungi RLS secara penuh tanpa memutus alur login.

---

## 2. Status Kebijakan RLS Aktual di Cloud Database (Hasil Audit Terverifikasi)

Berdasarkan audit langsung secara read-only terhadap `pg_tables` dan `pg_policies` pada instance Supabase Cloud (2026-10-12), berikut adalah status aktual seluruh tabel di skema `public`:

| Tabel | Status RLS (`rowsecurity`) | Policy Aktif | Command / Permissive | Hak Akses Role | Status Keamanan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`users`** | **ENABLED** | `Allow all on users` | ALL (qual: `true`, with_check: `true`) | `public` | ⚠️ **KRITIS**: Terbuka penuh via PostgREST jika tidak dibatasi API. Mitigasi aplikasi saat ini: query dialihkan ke Prisma. |
| **`tugas`** | **ENABLED** | `Allow all on tugas` | ALL (qual: `true`, with_check: `true`) | `public` | ⚠️ **KRITIS**: Siapa pun dengan `anon` key dapat membaca/mengubah/menghapus tugas semua pengguna via PostgREST. |
| **`jadwal`** | **ENABLED** | `Allow all on jadwal` | ALL (qual: `true`, with_check: `true`) | `public` | ⚠️ **KRITIS**: Terbuka penuh untuk semua pengguna via PostgREST. |
| **`ujian`** | **ENABLED** | `Allow all on ujian` | ALL (qual: `true`, with_check: `true`) | `public` | ⚠️ **KRITIS**: Terbuka penuh untuk semua pengguna via PostgREST. |
| **`kelas_pengganti`** | **ENABLED** | `Allow all on kelas_pengganti` | ALL (qual: `true`, with_check: `true`) | `public` | ⚠️ **KRITIS**: Terbuka penuh untuk semua pengguna via PostgREST. |
| **`admin_logs`** | **ENABLED** | *(Tidak ada policy)* | DENY ALL (default RLS) | - | ✅ Aman (Default deny). |
| **`announcements`** | **ENABLED** | *(Tidak ada policy)* | DENY ALL (default RLS) | - | ℹ️ Tidak dapat diakses via PostgREST tanpa policy. |
| **`settings`** | **ENABLED** | *(Tidak ada policy)* | DENY ALL (default RLS) | - | ℹ️ Tidak dapat diakses via PostgREST tanpa policy. |

> [!WARNING]
> Seluruh 5 tabel operasional utama (`users`, `jadwal`, `tugas`, `ujian`, `kelas_pengganti`) ternyata memiliki policy permisif `Allow all on ...` dengan kualifikasi `true` untuk role `public`. Temuan ini membuktikan bahwa `Allow all on tugas` bukan satu-satunya policy permisif di database. Mengganti policy-policy permisif ini dengan policy berbasis kepemilikan data pengguna (`auth_id` / `auth.uid()`) adalah prioritas utama pada Fase 4.

---

## 3. Matriks Kebijakan RLS yang Direkomendasikan

Tabel berikut merangkum postur keamanan yang direkomendasikan untuk seluruh tabel operasional:

| Tabel | Role `anon` (Klien Publik) | Role `authenticated` | Trusted Server (Prisma via `DATABASE_URL`) |
| :--- | :--- | :--- | :--- |
| **`users`** | **DENY ALL** (Tolak Baca/Tulis) | **DENY SELECT password** (Hanya baris sendiri) | **FULL ACCESS** (Verifikasi login & update profil) |
| **`jadwal`** | DENY ALL | CRUD jika `user_id = auth.uid()` | FULL ACCESS |
| **`tugas`** | DENY ALL | CRUD jika `user_id = auth.uid()` | FULL ACCESS |
| **`ujian`** | DENY ALL | CRUD jika `user_id = auth.uid()` | FULL ACCESS |
| **`kelas_pengganti`** | DENY ALL | CRUD jika `user_id = auth.uid()` | FULL ACCESS |

---

## 4. Prosedur Audit Policy Berkala

Pengembang dan administrator database disarankan menjalankan query audit berikut pada Supabase SQL Editor untuk memverifikasi status RLS:

```sql
-- Memeriksa status RLS seluruh tabel di skema public
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Memeriksa daftar policy aktif
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

