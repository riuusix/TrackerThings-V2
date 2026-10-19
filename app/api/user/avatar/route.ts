import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  AVATAR_BUCKET_NAME,
  validateAvatarFile,
  generateAvatarStoragePath,
  validateAvatarPathOwnership,
  sanitizeAvatarPublicUrl,
  getStorageClient,
} from "@/lib/avatarStorage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification & user ID isolation
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    // 2. Form data parsing
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return apiError("Payload form data tidak valid.", 400);
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError("File gambar profil wajib disertakan.", 400);
    }

    // 3. Size and magic-byte signature validation (JPEG, PNG, WebP)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateAvatarFile(buffer, file.size);
    if (!validation.valid || !validation.ext || !validation.mime) {
      return apiError(
        validation.error || "Format gambar tidak didukung. Harap unggah file JPEG, PNG, atau WebP yang valid.",
        400
      );
    }

    // 4. Fail-closed credential verification
    const storageClient = getStorageClient();
    if (!storageClient) {
      console.warn("[Avatar Storage] Missing server-side storage credentials (SUPABASE_SERVICE_ROLE_KEY). Failing closed.");
      return apiError(
        "Layanan penyimpanan profil belum terkonfigurasi pada server. Silakan hubungi administrator.",
        503
      );
    }

    // 5. Server-controlled path generation (strictly isolated to users/${session.userId}/)
    const filePath = generateAvatarStoragePath(session.userId, validation.ext);

    // Defense-in-depth ownership & traversal check
    if (!validateAvatarPathOwnership(filePath, session.userId)) {
      return apiError("Jalur penyimpanan file tidak valid.", 400);
    }

    // 6. Upload new avatar object to storage
    const { error: uploadError } = await storageClient.upload(filePath, buffer, {
      contentType: validation.mime,
      upsert: true,
    });

    if (uploadError) {
      console.error("[Avatar Storage] Storage upload failed for user ID:", session.userId, uploadError.message);
      return apiError("Gagal mengunggah foto ke penyimpanan.", 502);
    }

    // 7. Generate cache-busted public URL
    const publicUrlData = storageClient.getPublicUrl(filePath);
    const newAvatarUrl = sanitizeAvatarPublicUrl(publicUrlData.data?.publicUrl || "");

    // 8. Retrieve old avatar URL before mutating database
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { profilePictureUrl: true },
    });

    // 9. Update database with new URL
    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id: session.userId },
        data: {
          profilePictureUrl: newAvatarUrl,
          profileUpdatedAt: new Date(),
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          fullName: true,
          phoneNumber: true,
          profilePictureUrl: true,
          profileUpdatedAt: true,
        },
      });
    } catch (dbError: any) {
      // Safe atomic rollback: Delete the newly uploaded object to prevent orphan storage leaks
      console.error("[Avatar Storage] Database update failed. Rolling back uploaded file for user ID:", session.userId);
      await storageClient.remove([filePath]).catch(() => null);
      return apiError("Gagal memperbarui profil pengguna pada database.", 500);
    }

    // 10. Clean up previous avatar object ONLY after database update succeeded
    if (currentUser?.profilePictureUrl) {
      const oldUrl = currentUser.profilePictureUrl;
      const bucketMarker = `/${AVATAR_BUCKET_NAME}/`;
      if (oldUrl.includes(bucketMarker)) {
        const oldPath = oldUrl.split(bucketMarker)[1]?.split("?")[0];
        // Enforce ownership: oldPath MUST start with users/${session.userId}/ and no path traversal
        if (oldPath && oldPath !== filePath && validateAvatarPathOwnership(oldPath, session.userId)) {
          storageClient.remove([oldPath]).catch(() => {
            console.warn("[Avatar Storage] Warning: Cleanup of previous avatar object failed for user ID:", session.userId);
          });
        }
      }
    }

    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role || "user",
      fullName: updatedUser.fullName,
      full_name: updatedUser.fullName,
      phoneNumber: updatedUser.phoneNumber,
      phone_number: updatedUser.phoneNumber,
      profilePictureUrl: updatedUser.profilePictureUrl,
      profile_picture_url: updatedUser.profilePictureUrl,
      profileUpdatedAt: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
      profile_updated_at: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
    };

    return apiSuccess("Foto profil berhasil diperbarui!", safeUser, 200, { user: safeUser });
  } catch (err: any) {
    console.error("[Avatar Storage] Unexpected POST error:", err?.message || "Internal error");
    return apiError("Terjadi kesalahan internal pada server saat mengunggah foto profil.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Session verification & user ID isolation
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    // 2. Query current user profile
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { profilePictureUrl: true },
    });

    // 3. Idempotent check: if already null, return 200 immediately
    if (!currentUser?.profilePictureUrl) {
      const existingUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          fullName: true,
          phoneNumber: true,
          profilePictureUrl: true,
          profileUpdatedAt: true,
        },
      });

      const safeUser = {
        id: existingUser?.id || session.userId,
        username: existingUser?.username || session.username,
        email: existingUser?.email || session.email,
        role: existingUser?.role || "user",
        fullName: existingUser?.fullName || null,
        full_name: existingUser?.fullName || null,
        phoneNumber: existingUser?.phoneNumber || null,
        phone_number: existingUser?.phoneNumber || null,
        profilePictureUrl: null,
        profile_picture_url: null,
        profileUpdatedAt: existingUser?.profileUpdatedAt ? existingUser.profileUpdatedAt.toISOString() : null,
        profile_updated_at: existingUser?.profileUpdatedAt ? existingUser.profileUpdatedAt.toISOString() : null,
      };

      return apiSuccess("Foto profil berhasil dihapus.", safeUser, 200, { user: safeUser });
    }

    // 4. Remove object from storage if storage client is configured
    const storageClient = getStorageClient();
    const oldUrl = currentUser.profilePictureUrl;
    const bucketMarker = `/${AVATAR_BUCKET_NAME}/`;

    if (oldUrl.includes(bucketMarker) && storageClient) {
      const oldPath = oldUrl.split(bucketMarker)[1]?.split("?")[0];
      // Enforce ownership: only delete objects belonging to the authenticated user
      if (oldPath && validateAvatarPathOwnership(oldPath, session.userId)) {
        await storageClient.remove([oldPath]).catch(() => {
          console.warn("[Avatar Storage] Warning: Could not remove old storage file for user ID:", session.userId);
        });
      }
    }

    // 5. Update database record to null
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: {
        profilePictureUrl: null,
        profileUpdatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        phoneNumber: true,
        profilePictureUrl: true,
        profileUpdatedAt: true,
      },
    });

    const safeUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role || "user",
      fullName: updatedUser.fullName,
      full_name: updatedUser.fullName,
      phoneNumber: updatedUser.phoneNumber,
      phone_number: updatedUser.phoneNumber,
      profilePictureUrl: null,
      profile_picture_url: null,
      profileUpdatedAt: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
      profile_updated_at: updatedUser.profileUpdatedAt ? updatedUser.profileUpdatedAt.toISOString() : null,
    };

    return apiSuccess("Foto profil berhasil dihapus.", safeUser, 200, { user: safeUser });
  } catch (err: any) {
    console.error("[Avatar Storage] Unexpected DELETE error:", err?.message || "Internal error");
    return apiError("Terjadi kesalahan internal pada server saat menghapus foto profil.", 500);
  }
}
