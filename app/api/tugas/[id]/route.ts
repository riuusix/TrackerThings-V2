import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseDateOnly } from "@/lib/utils";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return apiError("ID tugas tidak valid.", 400);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const namaTugas = typeof body.nama_tugas === "string" ? body.nama_tugas.trim() : (typeof body.namaTugas === "string" ? body.namaTugas.trim() : "");
    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const deadline = body.deadline;
    const prioritas = body.prioritas || "Sedang";
    const jenis = body.jenis || "Individu";

    // Pastikan tugas ada dan milik user yang sedang login
    const existing = await prisma.tugas.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Tugas tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk mengubah tugas ini.", 403);
    }

    // Jika id_jadwal diubah, pastikan jadwal target juga milik user yang sama
    if (!isNaN(parsedJadwalId) && parsedJadwalId > 0) {
      const validJadwal = await prisma.jadwal.findFirst({
        where: { id: parsedJadwalId, userId: session.userId },
        select: { id: true },
      });
      if (!validJadwal) {
        return apiError("Jadwal mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
      }
    }

    const updateData: any = {
      prioritas,
      jenis,
    };
    if (namaTugas) updateData.namaTugas = namaTugas;
    if (!isNaN(parsedJadwalId) && parsedJadwalId > 0) updateData.idJadwal = parsedJadwalId;
    if (deadline) updateData.deadline = parseDateOnly(deadline);
    if (body.progress !== undefined && body.progress !== null) {
      const parsedProg = parseInt(body.progress, 10);
      if (!isNaN(parsedProg)) {
        const clamped = Math.min(100, Math.max(0, parsedProg));
        updateData.progress = clamped;
        updateData.status = clamped >= 100 ? "Selesai" : clamped > 0 ? "Sedang Dikerjakan" : "Belum Dikerjakan";
      }
    } else if (
      typeof body.status === "string" &&
      ["Belum Dikerjakan", "Sedang Dikerjakan", "Selesai"].includes(body.status)
    ) {
      updateData.status = body.status;
    }

    await prisma.tugas.update({
      where: { id: taskId },
      data: updateData,
    });

    return apiSuccess("Tugas berhasil diperbarui!", null, 200);
  } catch (error) {
    console.error("PUT /api/tugas/[id] exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat memperbarui tugas.", 500);
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

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return apiError("ID tugas tidak valid.", 400);
  }

  try {
    const existing = await prisma.tugas.findUnique({
      where: { id: taskId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return apiError("Tugas tidak ditemukan.", 404);
    }

    if (existing.userId !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk menghapus tugas ini.", 403);
    }

    await prisma.tugas.delete({
      where: { id: taskId },
    });

    return apiSuccess("Tugas berhasil dihapus!", null, 200);
  } catch (error) {
    console.error("DELETE /api/tugas/[id] exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat menghapus tugas.", 500);
  }
}

