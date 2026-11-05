import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseDateOnly } from "@/lib/utils";

function formatTaskResponse(t: any) {
  if (!t) return null;
  const jadwalNama = t.jadwal?.namaMatkul || t.jadwal?.nama_matkul || null;
  const isPinned = Boolean(t.isPinned ?? t.is_pinned ?? false);
  const rawReminder = t.reminderAt !== undefined ? t.reminderAt : t.reminder_at;
  const reminderIso =
    rawReminder instanceof Date
      ? rawReminder.toISOString()
      : typeof rawReminder === "string"
        ? rawReminder
        : null;
  return {
    id: t.id,
    user_id: t.userId,
    userId: t.userId,
    id_jadwal: t.idJadwal,
    idJadwal: t.idJadwal,
    nama_tugas: t.namaTugas,
    namaTugas: t.namaTugas,
    deadline: t.deadline instanceof Date ? t.deadline.toISOString() : t.deadline,
    prioritas: t.prioritas,
    jenis: t.jenis,
    status: t.status,
    progress: t.progress,
    is_pinned: isPinned,
    isPinned,
    reminder_at: reminderIso,
    reminderAt: reminderIso,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    jadwal: jadwalNama ? { nama_matkul: jadwalNama, namaMatkul: jadwalNama } : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const tasks = await prisma.tugas.findMany({
      where: { userId: session.userId },
      include: {
        jadwal: {
          select: { namaMatkul: true },
        },
      },
      orderBy: { deadline: "asc" },
    });

    const formattedTasks = tasks.map(formatTaskResponse);
    return apiSuccess("Daftar tugas berhasil dimuat.", formattedTasks, 200, { tasks: formattedTasks });
  } catch (error: any) {
    console.error("GET /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const namaTugas = typeof body.nama_tugas === "string" 
      ? body.nama_tugas.trim() 
      : (typeof body.namaTugas === "string" ? body.namaTugas.trim() : "");

    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const deadline = body.deadline;
    const prioritas = body.prioritas || "Sedang";
    const jenis = body.jenis || "Individu";

    if (!namaTugas || isNaN(parsedJadwalId) || !deadline) {
      return apiError("Nama tugas, id_jadwal, dan deadline wajib diisi.", 400);
    }

    const parsedDeadline = parseDateOnly(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return apiError("Format deadline tidak valid.", 400);
    }

    // Pastikan jadwal yang dikaitkan milik pengguna yang sedang login
    const jadwal = await prisma.jadwal.findFirst({
      where: {
        id: parsedJadwalId,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!jadwal) {
      return apiError("Jadwal mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
    }

    const rawPinned = body.is_pinned !== undefined ? body.is_pinned : body.isPinned;
    const isPinned = Boolean(rawPinned);
    const rawReminder = body.reminder_at !== undefined ? body.reminder_at : body.reminderAt;
    let parsedReminderAt: Date | null = null;
    if (rawReminder !== undefined && rawReminder !== null && rawReminder !== "") {
      parsedReminderAt = new Date(rawReminder);
      if (isNaN(parsedReminderAt.getTime())) {
        return apiError("Format waktu pengingat (reminder_at) tidak valid.", 400);
      }
    }

    const newTask = await prisma.tugas.create({
      data: {
        userId: session.userId,
        idJadwal: parsedJadwalId,
        namaTugas,
        deadline: parsedDeadline,
        prioritas,
        jenis,
        status: "Belum Dikerjakan",
        progress: 0,
        isPinned,
        reminderAt: parsedReminderAt,
      },
      include: {
        jadwal: {
          select: { namaMatkul: true },
        },
      },
    });

    const formatted = formatTaskResponse(newTask);
    return apiSuccess("Tugas berhasil dibuat!", formatted, 201, { task: formatted });
  } catch (error: any) {
    console.error("POST /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat membuat tugas.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const { id, progress } = body;
    const hasPinnedField = body.is_pinned !== undefined || body.isPinned !== undefined;
    const hasReminderField = body.reminder_at !== undefined || body.reminderAt !== undefined;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return apiError("ID tugas tidak valid.", 400);
    }

    if ((progress === undefined || progress === null) && !hasPinnedField && !hasReminderField) {
      return apiError("Nilai progress wajib diisi.", 400);
    }

    const updateData: Record<string, any> = {};

    if (progress !== undefined && progress !== null) {
      const parsedProgress = parseInt(progress, 10);
      if (isNaN(parsedProgress)) {
        return apiError("Nilai progress harus berupa angka.", 400);
      }
      const clampedProgress = Math.min(100, Math.max(0, parsedProgress));
      updateData.progress = clampedProgress;
      updateData.status =
        clampedProgress >= 100
          ? "Selesai"
          : clampedProgress > 0
            ? "Sedang Dikerjakan"
            : "Belum Dikerjakan";
    }

    if (hasPinnedField) {
      const rawPinned = body.is_pinned !== undefined ? body.is_pinned : body.isPinned;
      updateData.isPinned = Boolean(rawPinned);
    }

    if (hasReminderField) {
      const rawReminder = body.reminder_at !== undefined ? body.reminder_at : body.reminderAt;
      if (rawReminder === null || rawReminder === "") {
        updateData.reminderAt = null;
      } else {
        const parsedReminder = new Date(rawReminder);
        if (isNaN(parsedReminder.getTime())) {
          return apiError("Format waktu pengingat (reminder_at) tidak valid.", 400);
        }
        updateData.reminderAt = parsedReminder;
      }
    }

    // Periksa keberadaan dan kepemilikan tugas
    const existingTask = await prisma.tugas.findFirst({
      where: {
        id: taskId,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!existingTask) {
      return apiError("Tugas tidak ditemukan atau Anda tidak memiliki izin untuk mengubahnya.", 404);
    }

    const updated = await prisma.tugas.update({
      where: { id: taskId },
      data: updateData,
      include: {
        jadwal: {
          select: { namaMatkul: true },
        },
      },
    });

    const formatted = formatTaskResponse(updated);
    return apiSuccess("Progress tugas berhasil diperbarui!", formatted, 200, { task: formatted });
  } catch (error: any) {
    console.error("PATCH /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat memperbarui tugas.", 500);
  }
}
