import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const BUCKET_NAME = "avatars";

interface MagicByteCheck {
  mime: string;
  ext: string;
  check: (buf: Buffer) => boolean;
}

const SUPPORTED_TYPES: MagicByteCheck[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    ext: "webp",
    check: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return apiError("Payload form data tidak valid.", 400);
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError("File gambar profil wajib disertakan.", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("Ukuran file melebihi batas maksimal 2 MB.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verifikasi magic bytes (bukan hanya percaya nama file atau mime header klien)
    const detected = SUPPORTED_TYPES.find((t) => t.check(buffer));
    if (!detected) {
      return apiError(
        "Format gambar tidak didukung. Harap unggah file JPEG, PNG, atau WebP yang valid.",
        400
      );
    }

    // Periksa konfigurasi Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return apiError(
        "Infrastruktur penyimpanan Supabase belum terkonfigurasi. Kunci SUPABASE_SERVICE_ROLE_KEY belum diatur pada server.",
        503
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const timestamp = Date.now();
    const filePath = `users/${session.userId}/avatar-${timestamp}.${detected.ext}`;

    // Upload file ke bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: detected.mime,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return apiError(`Gagal mengunggah foto ke penyimpanan: ${uploadError.message}`, 502);
    }

    // Dapatkan URL publik dari file yang baru diunggah
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const newAvatarUrl = publicUrlData.publicUrl;

    // Ambil data user lama untuk membersihkan file avatar lama jika ada di bucket kita
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { profilePictureUrl: true },
    });

    // Simpan referensi URL baru ke database
    const updatedUser = await prisma.user.update({
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

    // Bersihkan file lama di Supabase Storage secara aman setelah referensi baru berhasil disimpan
    if (currentUser?.profilePictureUrl) {
      const oldUrl = currentUser.profilePictureUrl;
      const bucketMarker = `/${BUCKET_NAME}/`;
      if (oldUrl.includes(bucketMarker)) {
        const oldPath = oldUrl.split(bucketMarker)[1]?.split("?")[0];
        if (oldPath && oldPath !== filePath && oldPath.startsWith(`users/${session.userId}/`)) {
          supabaseAdmin.storage
            .from(BUCKET_NAME)
            .remove([oldPath])
            .catch((cleanupErr) => {
              console.warn("Gagal membersihkan avatar lama:", cleanupErr);
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
    console.error("POST /api/user/avatar error:", err);
    return apiError("Terjadi kesalahan internal pada server saat mengunggah foto profil.", 500);
  }
}

