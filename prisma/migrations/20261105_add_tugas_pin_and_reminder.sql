-- Add backward-compatible task pin and custom reminder timestamp columns
ALTER TABLE "tugas"
ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reminder_at" TIMESTAMPTZ NULL;
