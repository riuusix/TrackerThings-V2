import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseTimeToDate } from "@/lib/utils";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  const jadwalId = parseInt(params.id, 10);
  if (isNaN(jadwalId) || jadwalId <= 0) {
    return apiError("ID jadwal tidak valid.", 400);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const namaMatkul = typeof body.nama_matkul === "string" ? body.nama_matkul.trim() : (typeof body.namaMatkul === "string" ? body.namaMatkul.trim() : "");
    const hari = typeof body.hari === "string" ? body.hari.trim() : "";
    const waktuMulai = typeof body.waktu_mulai === "string" ? body.waktu_mulai.trim() : (typeof body.waktuMulai === "string" ? body.waktuMulai.trim() : "");
    const waktuSelesai = typeof body.waktu_selesai === "string" ? body.waktu_selesai.trim() : (typeof body.waktuSelesai === "string" ? body.waktuSelesai.trim() : "");

    const existing = await prisma.jadwal.findUnique({
      where: { id: jadwalId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Jadwal tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk mengubah jadwal ini.", 403);
    }

    const updateData: any = {};
    if (namaMatkul) updateData.namaMatkul = namaMatkul;
    if (hari) updateData.hari = hari;
    if (waktuMulai) {
      const parsed = parseTimeToDate(waktuMulai);
      if (!parsed) return apiError("Format waktu_mulai tidak valid (gunakan format HH:mm).", 400);
      updateData.waktuMulai = parsed;
    }
    if (waktuSelesai) {
      const parsed = parseTimeToDate(waktuSelesai);
      if (!parsed) return apiError("Format waktu_selesai tidak valid (gunakan format HH:mm).", 400);
      updateData.waktuSelesai = parsed;
    }
    if (body.dosen !== undefined) updateData.dosen = body.dosen;
    if (body.kategori !== undefined) updateData.kategori = body.kategori;
    if (body.lokasi !== undefined) updateData.lokasi = body.lokasi;

    await prisma.jadwal.update({
      where: { id: jadwalId },
      data: updateData,
    });

    return apiSuccess("Jadwal perkuliahan berhasil diperbarui!", null, 200);
  } catch (error) {
    console.error("PUT /api/jadwal/[id] exception:", error);
    return apiError("Gagal memperbarui jadwal perkuliahan.", 500);
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

  const jadwalId = parseInt(params.id, 10);
  if (isNaN(jadwalId) || jadwalId <= 0) {
    return apiError("ID jadwal tidak valid.", 400);
  }

  try {
    const existing = await prisma.jadwal.findUnique({
      where: { id: jadwalId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Jadwal tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk menghapus jadwal ini.", 403);
    }

    await prisma.jadwal.delete({
      where: { id: jadwalId },
    });

    return apiSuccess("Jadwal perkuliahan berhasil dihapus!", null, 200);
  } catch (error) {
    console.error("DELETE /api/jadwal/[id] exception:", error);
    return apiError("Gagal menghapus jadwal perkuliahan.", 500);
  }
}

