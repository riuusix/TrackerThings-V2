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

  const ujianId = parseInt(params.id, 10);
  if (isNaN(ujianId) || ujianId <= 0) {
    return apiError("ID ujian tidak valid.", 400);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    // Verifikasi keberadaan dan kepemilikan jadwal ujian
    const existing = await prisma.ujian.findUnique({
      where: { id: ujianId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Jadwal ujian tidak ditemukan.", 404);
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

      // Verifikasi mata kuliah baru milik pengguna
      const jadwal = await prisma.jadwal.findFirst({
        where: { id: parsedJadwalId, userId: session.userId },
        select: { id: true },
      });

      if (!jadwal) {
        return apiError("Mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
      }
      updatePayload.idJadwal = parsedJadwalId;
    }

    const jenisUjian = typeof body.jenis_ujian === "string" 
      ? body.jenis_ujian.trim() 
      : (typeof body.jenisUjian === "string" ? body.jenisUjian.trim() : null);
    if (jenisUjian) {
      updatePayload.jenisUjian = jenisUjian;
    }

    if (body.tanggal) {
      updatePayload.tanggal = parseDateOnly(body.tanggal);
    }

    if (body.waktu_mulai !== undefined || body.waktuMulai !== undefined) {
      const val = body.waktu_mulai !== undefined ? body.waktu_mulai : body.waktuMulai;
      updatePayload.waktuMulai = typeof val === "string" && val.trim() ? parseTimeToDate(val) : null;
    }

    if (body.waktu_selesai !== undefined || body.waktuSelesai !== undefined) {
      const val = body.waktu_selesai !== undefined ? body.waktu_selesai : body.waktuSelesai;
      updatePayload.waktuSelesai = typeof val === "string" && val.trim() ? parseTimeToDate(val) : null;
    }

    if (body.ruangan !== undefined) {
      updatePayload.ruangan = typeof body.ruangan === "string" ? body.ruangan.trim() : null;
    }

    if (body.catatan !== undefined) {
      updatePayload.catatan = typeof body.catatan === "string" ? body.catatan.trim() : null;
    }

    await prisma.ujian.update({
      where: { id: ujianId },
      data: updatePayload,
    });

    return apiSuccess("Jadwal ujian berhasil diperbarui!", null, 200);
  } catch (error) {
    console.error("PUT /api/ujian/[id] exception:", error);
    return apiError("Terjadi kesalahan server saat memperbarui jadwal ujian.", 500);
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

  const ujianId = parseInt(params.id, 10);
  if (isNaN(ujianId) || ujianId <= 0) {
    return apiError("ID ujian tidak valid.", 400);
  }

  try {
    const existing = await prisma.ujian.findUnique({
      where: { id: ujianId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Jadwal ujian tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk menghapus data ini.", 403);
    }

    await prisma.ujian.delete({
      where: { id: ujianId },
    });

    return apiSuccess("Jadwal ujian berhasil dihapus!", null, 200);
  } catch (error) {
    console.error("DELETE /api/ujian/[id] exception:", error);
    return apiError("Terjadi kesalahan server saat menghapus jadwal ujian.", 500);
  }
}

