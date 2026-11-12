-- Add composite and foreign-key B-tree indexes for user-scoped queries and sorting
-- Safe, idempotent migration (PostgreSQL / Supabase compatible)

CREATE INDEX IF NOT EXISTS "idx_jadwal_user_hari_waktu"
  ON "jadwal" ("user_id", "hari", "waktu_mulai");

CREATE INDEX IF NOT EXISTS "idx_jadwal_user_waktu"
  ON "jadwal" ("user_id", "waktu_mulai");

CREATE INDEX IF NOT EXISTS "idx_tugas_user_status_pinned_deadline"
  ON "tugas" ("user_id", "status", "is_pinned", "deadline");

CREATE INDEX IF NOT EXISTS "idx_tugas_user_deadline"
  ON "tugas" ("user_id", "deadline");

CREATE INDEX IF NOT EXISTS "idx_tugas_id_jadwal"
  ON "tugas" ("id_jadwal");

CREATE INDEX IF NOT EXISTS "idx_ujian_user_tanggal_waktu"
  ON "ujian" ("user_id", "tanggal", "waktu_mulai");

CREATE INDEX IF NOT EXISTS "idx_ujian_id_jadwal"
  ON "ujian" ("id_jadwal");

CREATE INDEX IF NOT EXISTS "idx_kelas_pengganti_user_status_tanggal"
  ON "kelas_pengganti" ("user_id", "status", "tanggal", "waktu_mulai");

CREATE INDEX IF NOT EXISTS "idx_kelas_pengganti_id_jadwal"
  ON "kelas_pengganti" ("id_jadwal");

CREATE INDEX IF NOT EXISTS "idx_announcements_active_created"
  ON "announcements" ("is_active", "created_at" DESC);

