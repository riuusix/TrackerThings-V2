# Template Pengajuan Perubahan Database — TrackerThings V2

Gunakan template ini saat merencanakan, menguji, atau mengusulkan perubahan pada skema database, model Prisma, atau kebijakan Row Level Security (RLS) di TrackerThings V2.

---

## 1. Informasi Dasar Perubahan

- **ID / Judul Perubahan**: `[RFC-DB-YYYYMMDD] Deskripsi Singkat`
- **Pengusul**: `Nama Developer / Tim`
- **Tanggal Pengajuan**: `YYYY-MM-DD`
- **Target Deployment**: `Development / Staging / Production`
- **Tingkat Dampak**: `Rendah / Sedang / Tinggi (Breaking Change)`

---

## 2. Latar Belakang & Kebutuhan

Jelaskan alasan teknis atau kebutuhan bisnis yang melatarbelakangi perubahan ini:
> *(Contoh: Penambahan kolom status semester pada profil mahasiswa untuk mendukung filter KRS.)*

---

## 3. Rincian Perubahan Skema

### 3.1 Perubahan Model Prisma (`prisma/schema.prisma`)
```prisma
// Tampilkan potongan kode model yang diubah/ditambahkan
model Contoh {
  // field baru
}
```

### 3.2 Perubahan DDL SQL PostgreSQL
```sql
-- Perintah SQL yang akan dieksekusi (jika ada)
ALTER TABLE tabel_nama ADD COLUMN kolom_baru TEXT;
```

### 3.3 Dampak terhadap Kebijakan RLS (Supabase)
- [ ] Tidak berdampak pada policy RLS.
- [ ] Memerlukan penambahan policy RLS baru:
  ```sql
  -- Tuliskan draf policy
  CREATE POLICY "nama_policy" ON tabel_nama ...
  ```
- [ ] Memerlukan modifikasi policy yang sudah ada.

---

## 4. Checklist Keamanan & Kompatibilitas

Sebelum perubahan disetujui, pastikan seluruh item berikut tercentang:

- [ ] **Tidak Mengekspos Kredensial**: Kolom baru tidak menyimpan data sensitif tanpa enkripsi/hashing.
- [ ] **Blokir Akses Anon Key**: Kolom privat tidak dapat dibaca oleh role `anon` via PostgREST.
- [ ] **Non-Destructive**: Tidak ada penghapusan kolom (`DROP COLUMN`) atau tabel (`DROP TABLE`) tanpa rencana migrasi data bertahap.
- [ ] **Kompatibilitas Backward**: Aplikasi versi saat ini tetap dapat berjalan saat skema baru diterapkan.
- [ ] **Kompilasi TypeScript**: Perintah `npm run build` (`prisma generate && next build`) berhasil tanpa error tipe data.
- [ ] **Uji Otomatis**: Seluruh pengujian endpoint pada `npm test` lulus (exit code 0).

---

## 5. Rencana Rollback

Jelaskan langkah mitigasi jika perubahan mengalami kendala saat diterapkan di production:
```sql
-- Skrip pengembalian ke kondisi semula (Rollback SQL)
```

