import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  const kpId = parseInt(params.id, 10);
  if (isNaN(kpId) || kpId <= 0) {
    return apiError("ID kelas pengganti tidak valid.", 400);
  }

  try {
    // Verifikasi keberadaan dan kepemilikan kelas pengganti
    const existing = await prisma.kelasPengganti.findUnique({
      where: { id: kpId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Kelas pengganti tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk mengubah data ini.", 403);
    }

    await prisma.kelasPengganti.update({
      where: { id: kpId },
      data: { status: "Selesai" },
    });

    return apiSuccess("Kelas berhasil ditandai selesai!", null, 200);
  } catch (error) {
    console.error("POST /api/kelas-pengganti/[id]/selesai exception:", error);
    return apiError("Terjadi kesalahan server saat memperbarui status kelas.", 500);
  }
}

