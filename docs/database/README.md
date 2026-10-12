# Sistem Dokumentasi Database — TrackerThings V2

Selamat datang di repositori dokumentasi database **TrackerThings V2**. Direktori ini merupakan sumber kebenaran (*single source of truth*) mengenai skema, relasi, kebijakan keamanan, dan prosedur perubahan database.

---

## 1. Ikhtisar Arsitektur Database

TrackerThings V2 menggunakan database relasional **PostgreSQL** (yang di-host pada platform Supabase) dengan arsitektur akses data hibrida (*Hybrid Data Access*):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        KLIEN (Browser / Native iOS)                   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
         (1) Submit Kredensial             (3) Operasional Data
        (Login Web / API iOS)             (Jadwal, Tugas, Ujian)
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│        NEXT.JS TRUSTED SERVER        │ │     SUPABASE POSTGREST API    │
│  - app/actions/auth.ts               │ │  - utils/supabase/server.ts   │
│  - app/api/auth/login/route.ts       │ │  - Akses via anon/pub key     │
│  - lib/auth.ts & lib/prisma.ts       │ └──────────────┬────────────────┘
└───────────────────┬──────────────────┘                │
                    │ (2) Query Internal                │
            Koneksi Direct TCP                          │ PostgREST HTTP
             (DATABASE_URL)                             │ (RLS Terproteksi)
                    ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  POSTGRESQL DATABASE (Supabase Managed)                │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │       Tabel users         │      │  Tabel jadwal, tugas, dll.  │   │
│   │  - Akses: Trusted Prisma  │      │  - Akses: PostgREST & RLS   │   │
│   │  - RLS: Blokir Anon Key   │      │  - Terisolasi per User ID   │   │
│   └───────────────────────────┘      └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Jalur Terpercaya Server (Prisma ORM - `lib/prisma.ts`)**:
   - Menghubungkan runtime server Next.js secara langsung ke PostgreSQL melalui connection string privat `DATABASE_URL`.
   - Digunakan khusus untuk operasi sensitif: **verifikasi kredensial akun** (`users`) saat login, pembaruan profil, dan transaksi yang memerlukan integritas tinggi.
   - **Keamanan**: Berjalan sepenuhnya di server. Connection string, password hash, dan kredensial database tidak pernah dikirim ke klien.
2. **Jalur PostgREST Terkelola (Supabase Client - `utils/supabase/server.ts`)**:
   - Menggunakan `@supabase/ssr` untuk membaca dan menulis data akademik harian (jadwal, tugas, ujian, kelas pengganti).
   - Terikat pada kebijakan Row Level Security (RLS) PostgreSQL untuk membatasi akses data per pengguna.

---

## 2. Struktur Dokumen

Dokumentasi ini dibagi menjadi dokumen-dokumen terfokus berikut:

| Dokumen | Deskripsi |
| :--- | :--- |
| **[`SCHEMA.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/SCHEMA.md)** | Spesifikasi lengkap skema database, tabel, kolom, tipe data, relasi, constraint, indeks, dan diagram ERD. |
| **[`POLICIES.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/POLICIES.md)** | Kebijakan keamanan, Row Level Security (RLS), pemisahan hak akses role `anon` vs trusted server, serta status verifikasi policy `Allow all on tugas`. |
| **[`CHANGELOG.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/CHANGELOG.md)** | Riwayat evolusi skema, migrasi dari arsitektur PHP legacy, dan catatan penguatan autentikasi kredensial. |
| **[`CHANGE_TEMPLATE.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/CHANGE_TEMPLATE.md)** | Panduan dan template standar untuk mengusulkan perubahan skema, penambahan tabel, atau modifikasi policy di masa mendatang. |

---

## 3. Aturan Utama Pengelolaan Database

1. **Prinsip Zero-Leak Kredensial**:
   Tabel `users` tidak boleh dibaca melalui API publik PostgREST menggunakan `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Verifikasi akun wajib dilakukan di backend melalui Prisma.
2. **Tanpa Perubahan Destruktif**:
   Dilarang menjalankan perintah SQL manual atau migrasi destruktif (`DROP TABLE`, `ALTER COLUMN DROP`, dll.) pada database production tanpa audit dampak menyeluruh.
3. **Pencatatan Perubahan Terstruktur**:
   Setiap perubahan skema di masa depan wajib mengikuti format pada [`CHANGE_TEMPLATE.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/CHANGE_TEMPLATE.md) dan dicatat pada [`CHANGELOG.md`](file:///C:/Users/Budy/Documents/TrackerThings-V2/docs/database/CHANGELOG.md).

