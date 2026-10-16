import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Avatar Upload & Storage Integration Tests", () => {
  it("verifies public.users schema uses profile_picture_url mapped to profilePictureUrl", () => {
    const prismaSchema = readRepoFile("prisma/schema.prisma");
    assert.match(prismaSchema, /profilePictureUrl\s+String\?\s+@map\("profile_picture_url"\)/);
    // Pastikan tidak ada duplikasi kolom photo_profile_url di model
    assert.doesNotMatch(prismaSchema, /photoProfileUrl/);
    assert.doesNotMatch(prismaSchema, /photo_profile_url/);
  });

  it("checks avatar upload route exists with magic-byte validation and 2MB limit", () => {
    const avatarRoute = readRepoFile("app/api/user/avatar/route.ts");
    assert.match(avatarRoute, /export async function POST/);
    assert.match(avatarRoute, /getAuthSession\(req\)/);
    assert.match(avatarRoute, /MAX_FILE_SIZE = 2 \* 1024 \* 1024/);
    // Magic byte detection
    assert.match(avatarRoute, /0xff/); // JPEG
    assert.match(avatarRoute, /0x89/); // PNG
    assert.match(avatarRoute, /RIFF/); // WebP
    assert.match(avatarRoute, /WEBP/); // WebP
    // Storage upload and profile picture update
    assert.match(avatarRoute, /supabaseAdmin\.storage/);
    assert.match(avatarRoute, /prisma\.user\.update/);
    assert.match(avatarRoute, /profilePictureUrl:\s*newAvatarUrl/);
    assert.match(avatarRoute, /users\/\$\{session\.userId\}\/avatar-/);
  });

  it("verifies Swift client services implement multipart upload and local cache update", () => {
    const networkService = readRepoFile("Sources/TrackerThings/Services/NetworkService.swift");
    const authService = readRepoFile("Sources/TrackerThings/Services/AuthService.swift");
    const settingsVM = readRepoFile("Sources/TrackerThings/ViewModels/SettingsViewModel.swift");
    const editProfileView = readRepoFile("Sources/TrackerThings/Views/Settings/EditProfileView.swift");

    // NetworkService
    assert.match(networkService, /func uploadMultipart<T:\s*Decodable\s*&\s*Sendable>/);
    assert.match(networkService, /multipart\/form-data;\s*boundary=/);

    // AuthService
    assert.match(authService, /func uploadAvatar\(data:\s*Data/);
    assert.match(authService, /LocalCacheService\.shared\.save\(updatedUser,\s*forKey:\s*LocalCacheService\.keyUserProfile\)/);

    // SettingsViewModel
    assert.match(settingsVM, /public var isUploadingAvatar:\s*Bool/);
    assert.match(settingsVM, /public func uploadAvatar\(data:\s*Data/);

    // EditProfileView
    assert.match(editProfileView, /import PhotosUI/);
    assert.match(editProfileView, /PhotosPicker\(/);
    assert.match(editProfileView, /handlePhotoSelection/);
    assert.match(editProfileView, /jpegData\(compressionQuality:\s*0\.8\)/);
  });

  it("verifies Web ProfileClient supports direct file upload to /api/user/avatar", () => {
    const profileClient = readRepoFile("app/profile/ProfileClient.tsx");
    assert.match(profileClient, /handlePhotoUpload/);
    assert.match(profileClient, /fetch\("\/api\/user\/avatar"/);
    assert.match(profileClient, /accept="image\/jpeg,image\/png,image\/webp"/);
  });
});
