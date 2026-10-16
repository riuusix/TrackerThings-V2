import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseDateOnly, parseTimeToDate } from "@/lib/utils";

export async function PUT(
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

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

    const updatePayload: Record<string, any> = {};

    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    if (rawJadwalId !== undefined) {
      const parsedJadwalId = parseInt(rawJadwalId, 10);
      if (isNaN(parsedJadwalId) || parsedJadwalId <= 0) {
        return apiError("ID mata kuliah tidak valid.", 400);
      }

      const jadwal = await prisma.jadwal.findFirst({
        where: { id: parsedJadwalId, userId: session.userId },
        select: { id: true },
      });

      if (!jadwal) {
        return apiError("Mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
      }
      updatePayload.idJadwal = parsedJadwalId;
    }

    if (body.tanggal) {
      const parsedDate = parseDateOnly(body.tanggal);
      if (isNaN(parsedDate.getTime())) {
        return apiError("Format tanggal tidak valid.", 400);
      }
      updatePayload.tanggal = parsedDate;
    }

    if (body.waktu_mulai !== undefined || body.waktuMulai !== undefined) {
      const val = body.waktu_mulai !== undefined ? body.waktu_mulai : body.waktuMulai;
      if (typeof val === "string" && val.trim()) {
        const parsedMulai = parseTimeToDate(val.trim());
        if (!parsedMulai) {
          return apiError("Format waktu_mulai tidak valid (gunakan format HH:mm).", 400);
        }
        updatePayload.waktuMulai = parsedMulai;
      }
    }

    if (body.waktu_selesai !== undefined || body.waktuSelesai !== undefined) {
      const val = body.waktu_selesai !== undefined ? body.waktu_selesai : body.waktuSelesai;
      if (typeof val === "string" && val.trim()) {
        const parsedSelesai = parseTimeToDate(val.trim());
        if (!parsedSelesai) {
          return apiError("Format waktu_selesai tidak valid (gunakan format HH:mm).", 400);
        }
        updatePayload.waktuSelesai = parsedSelesai;
      }
    }

    if (body.lokasi !== undefined) {
      updatePayload.lokasi = typeof body.lokasi === "string" && body.lokasi.trim() ? body.lokasi.trim() : null;
    }

    if (body.catatan !== undefined) {
      updatePayload.catatan = typeof body.catatan === "string" && body.catatan.trim() ? body.catatan.trim() : null;
    }

    if (typeof body.status === "string" && body.status.trim()) {
      updatePayload.status = body.status.trim();
    }

    await prisma.kelasPengganti.update({
      where: { id: kpId },
      data: updatePayload,
    });

    return apiSuccess("Kelas pengganti berhasil diperbarui!", null, 200);
  } catch (error) {
    console.error("PUT /api/kelas-pengganti/[id] exception:", error);
    return apiError("Terjadi kesalahan server saat memperbarui kelas pengganti.", 500);
  }
}

export async function DELETE(
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
    const existing = await prisma.kelasPengganti.findUnique({
      where: { id: kpId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Kelas pengganti tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk menghapus data ini.", 403);
    }

    await prisma.kelasPengganti.delete({
      where: { id: kpId },
    });

    return apiSuccess("Kelas pengganti berhasil dihapus!", null, 200);
  } catch (error) {
    console.error("DELETE /api/kelas-pengganti/[id] exception:", error);
    return apiError("Terjadi kesalahan server saat menghapus kelas pengganti.", 500);
  }
}

