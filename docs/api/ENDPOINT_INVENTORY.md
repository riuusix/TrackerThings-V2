# TrackerThings V2 — API Endpoint Inventory & Standardization Contract

Dokumentasi resmi arsitektur backend, spesifikasi endpoint, otentikasi/otorisasi, kontrak respons, dan status pengujian untuk TrackerThings V2.

---

## 1. Standarisasi Kontrak Respons (`lib/apiResponse.ts`)

Seluruh endpoint API Next.js Route Handlers (`app/api/**`) menggunakan format envelope seragam untuk kompatibilitas Web dan iOS SwiftUI:

### Format Berhasil (HTTP 2xx)
```json
{
  "success": true,
  "message": "Deskripsi aksi berhasil",
  "code": 200,
  "data": { ... } | [ ... ],
  "<resource_name>": { ... } | [ ... ]
}
```

### Format Error (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "message": "Pesan kesalahan ramah pengguna",
  "code": 400,
  "error": "Pesan kesalahan atau kode error teknis"
}
```

### Prinsip Dual-Naming (Web & Swift Codable)
Setiap field objek data mengembalikan format **dual-naming**:
- `camelCase` (misal: `userId`, `namaMatkul`, `waktuMulai`, `fullName`) untuk Web JavaScript/TypeScript.
- `snake_case` (misal: `user_id`, `nama_matkul`, `waktu_mulai`, `full_name`) untuk model Swift `Codable`.

---

## 2. Inventaris Endpoint API

| Endpoint | HTTP Method | Autentikasi | Validasi Input | Ownership Check / RBAC | Database Query (Prisma) | Response Contract | Status Pengujian |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Publik | Validasi username & password non-empty | N/A (Kredensial bcrypt) | `prisma.user.findUnique` | `{ success, user, token }` | **PASS (31/31 Suite)** |
| `/api/auth/register` | `POST` | Publik | Validasi format email regex, panjang sandi $\ge 6$, username unik | N/A (Uniqueness check) | `prisma.user.findFirst`, `prisma.user.create` | `{ success, user }` | **PASS (31/31 Suite)** |
| `/api/user/profile` | `GET` | Bearer / Cookie | Token JWT valid | `session.userId` | `prisma.user.findUnique` | `{ success, data, user }` | **PASS (24/24 CRUD)** |
| `/api/user/profile` | `PUT` | Bearer / Cookie | Sanitasi string, regex email, cek duplikasi email | `session.userId` | `prisma.user.findFirst`, `prisma.user.update` | `{ success, data, user }` | **PASS (24/24 CRUD)** |
| `/api/profile` | `GET` | Bearer / Cookie | Token JWT valid | `session.userId` | `prisma.user.findUnique` | `{ success, data, user }` | **PASS (24/24 CRUD)** |
| `/api/profile` | `PUT` | Bearer / Cookie | Sanitasi string, regex email | `session.userId` | `prisma.user.findFirst`, `prisma.user.update` | `{ success, data, user }` | **PASS (24/24 CRUD)** |
| `/api/user/password` | `PUT` | Bearer / Cookie | Password lama, password baru $\ge 6$, verifikasi bcrypt | `session.userId` | `prisma.user.findUnique`, `prisma.user.update` | `{ success, message }` | **PASS (31/31 Suite)** |
| `/api/admin/dashboard` | `GET` | Bearer / Cookie + Admin Role | Token JWT valid | Role verification di DB (`role === 'admin'`) | `prisma.user.count`, `prisma.jadwal.count`, dll. | `{ success, data, metrics }` | **PASS (24/24 CRUD)** |
| `/api/jadwal` | `GET` | Bearer / Cookie | Token JWT valid | Filter `userId: session.userId` | `prisma.jadwal.findMany` | `{ success, data, jadwal }` | **PASS (24/24 CRUD)** |
| `/api/jadwal` | `POST` | Bearer / Cookie | Wajib nama matkul, hari, format jam `HH:mm` | Assigment `userId: session.userId` | `prisma.jadwal.create` | `{ success, data, jadwal }` | **PASS (24/24 CRUD)** |
| `/api/jadwal/[id]` | `PUT` | Bearer / Cookie | ID numerik $>0$, format jam `HH:mm` | `existing.userId === session.userId` (403 IDOR) | `prisma.jadwal.findUnique`, `prisma.jadwal.update` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/jadwal/[id]` | `DELETE` | Bearer / Cookie | ID numerik $>0$ | `existing.userId === session.userId` (403 IDOR) | `prisma.jadwal.findUnique`, `prisma.jadwal.delete` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/tugas` | `GET` | Bearer / Cookie | Token JWT valid | Filter `userId: session.userId` | `prisma.tugas.findMany` | `{ success, data, tasks }` | **PASS (24/24 CRUD)** |
| `/api/tugas` | `POST` | Bearer / Cookie | Nama tugas, id_jadwal, deadline valid | Jadwal target wajib milik `session.userId` (404/403) | `prisma.jadwal.findFirst`, `prisma.tugas.create` | `{ success, data, task }` | **PASS (24/24 CRUD)** |
| `/api/tugas/[id]` | `PUT` | Bearer / Cookie | ID numerik $>0$, deadline valid | `existing.userId === session.userId` & target jadwal valid | `prisma.tugas.findUnique`, `prisma.tugas.update` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/tugas/[id]` | `DELETE` | Bearer / Cookie | ID numerik $>0$ | `existing.userId === session.userId` (403 IDOR) | `prisma.tugas.findUnique`, `prisma.tugas.delete` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/ujian` | `GET` | Bearer / Cookie | Token JWT valid | Filter `userId: session.userId` | `prisma.ujian.findMany` | `{ success, data, exams }` | **PASS (24/24 CRUD)** |
| `/api/ujian` | `POST` | Bearer / Cookie | id_jadwal, jenis_ujian, tanggal valid | Jadwal target wajib milik `session.userId` (404/403) | `prisma.jadwal.findFirst`, `prisma.ujian.create` | `{ success, data, exam }` | **PASS (24/24 CRUD)** |
| `/api/ujian/[id]` | `PUT` | Bearer / Cookie | ID numerik $>0$, format tanggal & jam | `existing.userId === session.userId` (403 IDOR) | `prisma.ujian.findUnique`, `prisma.ujian.update` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/ujian/[id]` | `DELETE` | Bearer / Cookie | ID numerik $>0$ | `existing.userId === session.userId` (403 IDOR) | `prisma.ujian.findUnique`, `prisma.ujian.delete` | `{ success, message }` | **PASS (24/24 CRUD)** |
| `/api/kelas-pengganti` | `GET` | Bearer / Cookie | Token JWT valid | Filter `userId: session.userId` | `prisma.kelasPengganti.findMany` | `{ success, data, kelas_pengganti }` | **PASS (24/24 CRUD)** |
| `/api/kelas-pengganti` | `POST` | Bearer / Cookie | id_jadwal, tanggal, waktu_mulai, waktu_selesai | Jadwal target wajib milik `session.userId` (404/403) | `prisma.jadwal.findFirst`, `prisma.kelasPengganti.create` | `{ success, data, kelas_pengganti }` | **PASS (24/24 CRUD)** |
| `/api/kelas-pengganti/[id]/selesai` | `POST` | Bearer / Cookie | ID numerik $>0$ | `existing.userId === session.userId` (403 IDOR) | `prisma.kelasPengganti.findUnique`, `prisma.kelasPengganti.update` | `{ success, message }` | **PASS (24/24 CRUD)** |

---

## 3. Resolusi Masalah Protokol & Supabase Pooler

### Akar Masalah PostgreSQL `08P01: insufficient data left in message`
- **Penyebab**: Kolom PostgreSQL `waktu_mulai` dan `waktu_selesai` bertipe `time without time zone`, sedangkan `deadline` dan `tanggal` bertipe `date`. Pengiriman string format ISO timestamp penuh yang tidak sesuai pemetaan native membuat wire protocol parser PostgreSQL terhenti di tengah transmisi parameter biner melalui Supabase PgBouncer (Port 6543, transaction mode).
- **Solusi**:
  1. `prisma/schema.prisma` diperbarui dengan anotasi native:
     - `waktuMulai DateTime @db.Time`
     - `waktuSelesai DateTime @db.Time`
     - `deadline DateTime @db.Date`
     - `tanggal DateTime @db.Date`
  2. Utilitas `lib/utils.ts` menyediakan helper konversi:
     - `parseTimeToDate("HH:mm")` menghasilkan Date UTC referensi `1970-01-01THH:mm:00.000Z`.
     - `formatTimeFromDate(date)` mengembalikan format `HH:mm`.
     - `parseDateOnly("YYYY-MM-DD")` menghasilkan Date UTC murni tanpa offset jam.
  3. Konfigurasi `DATABASE_URL` menggunakan PgBouncer transaction mode (`?pgbouncer=true&connection_limit=1`) dengan singleton Prisma Client global (`lib/prisma.ts`).

---

## 4. Kompatibilitas SwiftUI iOS (`NetworkService.swift`)

Decoder pada `NetworkService.swift` mendukung:
1. Decoding langsung tipe target `T.self`.
2. Fallback decoding standardized envelope:
   - `DataEnvelope<T>` (`data`)
   - `UserEnvelope<T>` (`user`)
   - `TaskEnvelope<T>` (`task`)
   - `TasksEnvelope<T>` (`tasks`)
   - `JadwalEnvelope<T>` (`jadwal`)
   - `ExamsEnvelope<T>` (`exams`)
   - `KelasPenggantiEnvelope<T>` (`kelas_pengganti`)

---

## 5. Ringkasan Hasil Pengujian

1. **Security Baseline Tests (`tests/verify-endpoints.mjs`)**:
   - Total: **31 / 31 PASS**
   - Menguji: Unauthenticated protection, tampering token rejection, redirect path sanitization, JOSE signature mismatch, password hash exclusion.
2. **Static Codebase Security Audit (`tests/audit-codebase-security.mjs`)**:
   - Total: **57 file dipindai**
   - Hasil: **0 PostgREST queries** tersisa pada tabel sensitif.
3. **Authenticated CRUD, IDOR, & RBAC Tests (`tests/test-api-crud-authenticated.mjs`)**:
   - Total: **24 / 24 PASS**
   - Menguji: Full CRUD untuk Jadwal, Tugas, Ujian, Kelas Pengganti, isolasi User A vs User B (pencegahan IDOR 403), otentikasi role admin vs non-admin (RBAC 403 vs 200).

