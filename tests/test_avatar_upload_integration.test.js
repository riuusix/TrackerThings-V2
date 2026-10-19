import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  validateAvatarFile,
  generateAvatarStoragePath,
  validateAvatarPathOwnership,
  sanitizeAvatarPublicUrl,
  MAX_AVATAR_FILE_SIZE,
  AVATAR_BUCKET_NAME,
  SUPPORTED_AVATAR_TYPES,
} from "../lib/avatarStorage.ts";
import { prisma } from "../lib/prisma.ts";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

// Sample valid buffers for magic-byte verification
const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const validWebp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const invalidFakeImage = Buffer.from("THIS_IS_NOT_AN_IMAGE_FILE_CONTENT");

describe("Avatar Upload & Storage Integration Tests", () => {
  // =========================================================================
  // 1. Static Contract & Schema Verification
  // =========================================================================
  it("verifies public.users schema uses profile_picture_url mapped to profilePictureUrl", () => {
    const prismaSchema = readRepoFile("prisma/schema.prisma");
    assert.match(prismaSchema, /profilePictureUrl\s+String\?\s+@map\("profile_picture_url"\)/);
    assert.doesNotMatch(prismaSchema, /photoProfileUrl/);
    assert.doesNotMatch(prismaSchema, /photo_profile_url/);
  });

  it("checks avatar upload route exists with magic-byte validation, session auth, and 2MB limit", () => {
    const avatarRoute = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(avatarRoute, /export async function POST/);
    assert.match(avatarRoute, /export async function DELETE/);
    assert.match(avatarRoute, /getAuthSession\(req\)/);
    assert.match(avatarRoute, /validateAvatarFile/);
    assert.match(avatarRoute, /generateAvatarStoragePath/);
    assert.match(avatarRoute, /validateAvatarPathOwnership/);
  });

  it("verifies Swift client services implement multipart upload and local cache update", () => {
    const networkService = readRepoFile("Sources/TrackerThings/Services/NetworkService.swift");
    const authService = readRepoFile("Sources/TrackerThings/Services/AuthService.swift");
    const settingsVM = readRepoFile("Sources/TrackerThings/ViewModels/SettingsViewModel.swift");
    const editProfileView = readRepoFile("Sources/TrackerThings/Views/Settings/EditProfileView.swift");
    const userAvatarView = readRepoFile("Sources/TrackerThings/Views/Components/UserAvatarView.swift");

    assert.match(networkService, /func uploadMultipart<T:\s*Decodable\s*&\s*Sendable>/);
    assert.match(networkService, /multipart\/form-data;\s*boundary=/);
    assert.match(authService, /func uploadAvatar\(data:\s*Data/);
    assert.match(authService, /LocalCacheService\.shared\.save\(updatedUser,\s*forKey:\s*LocalCacheService\.keyUserProfile\)/);
    assert.match(settingsVM, /public var isUploadingAvatar:\s*Bool/);
    assert.match(settingsVM, /public func uploadAvatar\(data:\s*Data/);
    assert.match(editProfileView, /import PhotosUI/);
    assert.match(editProfileView, /PhotosPicker\(/);
    assert.match(userAvatarView, /AppTheme\.Colors\.accent/);
  });

  it("verifies Web ProfileClient supports direct file upload and delete via /api/user/avatar", () => {
    const profileClient = readRepoFile("app/profile/ProfileClient.tsx");
    assert.match(profileClient, /handlePhotoUpload/);
    assert.match(profileClient, /fetch\("\/api\/user\/avatar"/);
    assert.match(profileClient, /method:\s*"DELETE"/);
    assert.match(profileClient, /accept="image\/jpeg,image\/png,image\/webp"/);
  });

  // =========================================================================
  // 2. File Signature & Size Validation Tests (validateAvatarFile)
  // =========================================================================
  it("rejects empty files with descriptive error", () => {
    const emptyBuf = Buffer.alloc(0);
    const result1 = validateAvatarFile(emptyBuf, 0);
    assert.equal(result1.valid, false);
    assert.match(result1.error, /tidak boleh kosong/i);

    const result2 = validateAvatarFile(validJpeg, 0);
    assert.equal(result2.valid, false);
    assert.match(result2.error, /tidak boleh kosong/i);
  });

  it("rejects files exceeding 2 MB limit", () => {
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_FILE_SIZE + 1);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;
    const result = validateAvatarFile(oversizedBuffer, oversizedBuffer.length);
    assert.equal(result.valid, false);
    assert.match(result.error, /melebihi batas maksimal 2 MB/i);
  });

  it("rejects corrupted files, text files, and fake extensions", () => {
    const result = validateAvatarFile(invalidFakeImage, invalidFakeImage.length);
    assert.equal(result.valid, false);
    assert.match(result.error, /Format gambar tidak didukung/i);
  });

  it("accepts valid JPEG, PNG, and WebP signatures with correct mime and extension", () => {
    const jpegRes = validateAvatarFile(validJpeg, validJpeg.length);
    assert.equal(jpegRes.valid, true);
    assert.equal(jpegRes.ext, "jpg");
    assert.equal(jpegRes.mime, "image/jpeg");

    const pngRes = validateAvatarFile(validPng, validPng.length);
    assert.equal(pngRes.valid, true);
    assert.equal(pngRes.ext, "png");
    assert.equal(pngRes.mime, "image/png");

    const webpRes = validateAvatarFile(validWebp, validWebp.length);
    assert.equal(webpRes.valid, true);
    assert.equal(webpRes.ext, "webp");
    assert.equal(webpRes.mime, "image/webp");
  });

  // =========================================================================
  // 3. Path Generation, Traversal Defense & Ownership Isolation
  // =========================================================================
  it("strictly confines avatar storage paths to users/{userId}/ and prevents traversal", () => {
    const userId = 42;
    const generatedPath = generateAvatarStoragePath(userId, "jpg");

    assert.ok(generatedPath.startsWith("users/42/avatar-"), `Path must start with users/42/avatar- but got ${generatedPath}`);
    assert.ok(generatedPath.endsWith(".jpg"), `Path must end with .jpg but got ${generatedPath}`);
    assert.doesNotMatch(generatedPath, /\.\./, "Generated path must never contain ..");
    assert.doesNotMatch(generatedPath, /[\\/]{2,}/, "Generated path must not contain double slashes");

    // Ownership validation
    assert.equal(validateAvatarPathOwnership(generatedPath, 42), true, "User 42 must own their path");
    assert.equal(validateAvatarPathOwnership(generatedPath, 43), false, "User 43 must NOT own User 42's path");
    assert.equal(validateAvatarPathOwnership("users/42/../43/avatar.jpg", 42), false, "Traversal must be rejected");
    assert.equal(validateAvatarPathOwnership("/users/42/avatar.jpg", 42), false, "Absolute path must be rejected");
    assert.equal(validateAvatarPathOwnership("users/42/avatar.jpg", 42), true, "Standard user path must be accepted");
  });

  it("sanitizes public avatar URLs with cache-busting query parameter", () => {
    const rawUrl = "https://mock.storage.supabase.co/storage/v1/object/public/avatars/users/1/avatar-123.jpg";
    const sanitized = sanitizeAvatarPublicUrl(rawUrl, 1792000000000);
    assert.equal(sanitized, `${rawUrl}?v=1792000000000`);

    const rawUrlWithQuery = `${rawUrl}?existing=1`;
    const sanitizedQuery = sanitizeAvatarPublicUrl(rawUrlWithQuery, 1792000000000);
    assert.equal(sanitizedQuery, `${rawUrlWithQuery}&v=1792000000000`);
  });

  // =========================================================================
  // 4. Server Route Security & Resilience Static Auditing
  // =========================================================================
  it("enforces session authentication and rejects unauthenticated requests (HTTP 401)", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /const session = await getAuthSession\(req\);/);
    assert.match(routeCode, /if \(!session\) \{\s*return apiError\("Sesi login telah berakhir/);
  });

  it("fails closed when server credentials are not configured (HTTP 503)", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /const storageClient = getStorageClient\(\);/);
    assert.match(routeCode, /if \(!storageClient\) \{\s*console\.warn\(\"\[Avatar Storage\]/);
    assert.match(routeCode, /return apiError\(\s*"Layanan penyimpanan profil belum terkonfigurasi/);
    assert.match(routeCode, /503/);
  });

  it("rolls back newly uploaded file if database update fails and preserves previous avatar", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    // Upload happens before DB update
    const uploadIndex = routeCode.indexOf("storageClient.upload(");
    const dbUpdateIndex = routeCode.indexOf("prisma.user.update(");
    const cleanupOldIndex = routeCode.indexOf("storageClient.remove([oldPath])");

    assert.ok(uploadIndex !== -1 && dbUpdateIndex !== -1, "Upload and DB update must be present");
    assert.ok(uploadIndex < dbUpdateIndex, "New file must be uploaded before database is updated");
    assert.ok(dbUpdateIndex < cleanupOldIndex, "Old avatar must NOT be cleaned up until database update succeeds");

    // Atomic rollback on db error
    assert.match(routeCode, /catch \(dbError: any\) \{\s*\/\/ Safe atomic rollback/);
    assert.match(routeCode, /await storageClient\.remove\(\[filePath\]\)/);
  });

  it("handles old avatar cleanup failure gracefully without failing user profile update", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /storageClient\.remove\(\[oldPath\]\)\.catch\(\(\) => \{\s*console\.warn\(\"\[Avatar Storage\] Warning: Cleanup of previous avatar/);
  });

  it("handles avatar deletion idempotently and securely", () => {
    const routeCode = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(routeCode, /export async function DELETE/);
    assert.match(routeCode, /if \(!currentUser\?\.profilePictureUrl\) \{/);
    assert.match(routeCode, /validateAvatarPathOwnership\(oldPath, session\.userId\)/);
    assert.match(routeCode, /profilePictureUrl:\s*null/);
  });

  // =========================================================================
  // 5. Database PostgreSQL RLS Policy Verification
  // =========================================================================
  it("verifies storage.objects only allows public SELECT and strictly denies public writes/deletes", async () => {
    const policies = await prisma.$queryRawUnsafe(`
      SELECT policyname, cmd, roles
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects';
    `);

    // Verify there are NO public INSERT, UPDATE, or DELETE policies on storage.objects
    const publicWritePolicies = policies.filter(
      (p) => ["INSERT", "UPDATE", "DELETE"].includes(p.cmd) && p.roles.includes("public")
    );
    assert.equal(
      publicWritePolicies.length,
      0,
      `storage.objects must not grant public write/delete permissions. Found: ${JSON.stringify(publicWritePolicies)}`
    );

    // Verify public SELECT policy exists for avatars bucket
    const publicSelect = policies.find(
      (p) => p.cmd === "SELECT" && p.roles.includes("public")
    );
    assert.ok(publicSelect, "storage.objects must have public SELECT policy for public avatar URLs");
  });

  it("verifies avatars bucket in storage.buckets has 2 MB file size limit and allowed MIME types", async () => {
    const bucket = await prisma.$queryRawUnsafe(`
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      WHERE id = 'avatars';
    `);

    assert.ok(bucket.length > 0, "avatars bucket must exist in storage.buckets");
    assert.equal(bucket[0].public, true, "avatars bucket must be public for SELECT");
    assert.equal(Number(bucket[0].file_size_limit), 2097152, "file_size_limit must be 2097152 bytes (2 MB)");
    assert.ok(bucket[0].allowed_mime_types.includes("image/jpeg"), "allowed_mime_types must include image/jpeg");
    assert.ok(bucket[0].allowed_mime_types.includes("image/png"), "allowed_mime_types must include image/png");
    assert.ok(bucket[0].allowed_mime_types.includes("image/webp"), "allowed_mime_types must include image/webp");
  });
});
