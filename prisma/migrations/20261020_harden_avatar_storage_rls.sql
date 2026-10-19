-- ====================================================================
-- Migration: 20261020_harden_avatar_storage_rls.sql
-- Description: Harden Supabase Storage RLS Policies for Avatars Bucket
-- Objective:
-- 1. Ensure 'avatars' bucket exists with public read-only access (SELECT),
--    a 2 MB file size limit, and strict MIME type whitelisting.
-- 2. Revoke all public write, update, and delete access on storage.objects.
-- 3. Enforce that avatar mutations (upload, replacement, deletion) must
--    be performed exclusively through the authenticated application API
--    using server-side credentials and ownership validation.
-- ====================================================================

-- Step 1: Ensure bucket configuration has strict constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB limit in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Step 2: Drop insecure public write, update, and delete policies
DROP POLICY IF EXISTS "Public Insert for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Update for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes for avatars" ON storage.objects;

-- Step 3: Ensure public SELECT policy is strictly limited to bucket_id = 'avatars'
DROP POLICY IF EXISTS "Public Access for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Select for Avatars" ON storage.objects;

CREATE POLICY "Public Access for Avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
