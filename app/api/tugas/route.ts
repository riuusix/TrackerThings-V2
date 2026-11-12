import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseDateOnly } from "@/lib/utils";
import { getOrComputeUserCache, invalidateUserServerCache } from "@/lib/serverCache";

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

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status")?.trim() || null;
    const pinnedParam = searchParams.get("pinned")?.trim() || null;
    const prioritasParam = searchParams.get("prioritas")?.trim() || null;
    const idJadwalParam = searchParams.get("idJadwal") || searchParams.get("id_jadwal");
    const searchQuery = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || null;
    const sortParam = searchParams.get("sort")?.trim() || "deadline_asc";
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");

    const hasFilterOrPagination = Boolean(
      statusParam ||
        pinnedParam ||
        prioritasParam ||
        idJadwalParam ||
        searchQuery ||
        pageParam ||
        limitParam ||
        cursorParam ||
        sortParam !== "deadline_asc"
    );

    const cacheSubKey = searchParams.toString() || "all";

    const { data: resultPayload, cacheStatus } = await getOrComputeUserCache(
      session.userId,
      "tugas",
      cacheSubKey,
      async () => {
        const where: Record<string, any> = {
          userId: session.userId,
        };

        if (statusParam) {
          const normalized = statusParam.toLowerCase();
          if (normalized === "active" || normalized === "aktif") {
            where.status = { not: "Selesai" };
          } else if (normalized === "completed" || normalized === "selesai" || normalized === "history") {
            where.status = "Selesai";
          } else {
            where.status = statusParam;
          }
        }

        if (pinnedParam === "true" || pinnedParam === "1") {
          where.isPinned = true;
        } else if (pinnedParam === "false" || pinnedParam === "0") {
          where.isPinned = false;
        }

        if (prioritasParam && prioritasParam.toLowerCase() !== "all" && prioritasParam.toLowerCase() !== "semua") {
          where.prioritas = prioritasParam;
        }

        if (idJadwalParam) {
          const parsedCourseId = parseInt(idJadwalParam, 10);
          if (!isNaN(parsedCourseId) && parsedCourseId > 0) {
            where.idJadwal = parsedCourseId;
          }
        }

        if (searchQuery) {
          where.OR = [
            { namaTugas: { contains: searchQuery, mode: "insensitive" } },
            { jadwal: { namaMatkul: { contains: searchQuery, mode: "insensitive" } } },
          ];
        }

        let orderBy: any = { deadline: "asc" };
        switch (sortParam) {
          case "deadline_desc":
            orderBy = [{ deadline: "desc" }, { id: "desc" }];
            break;
          case "progress_desc":
            orderBy = [{ progress: "desc" }, { deadline: "asc" }];
            break;
          case "pinned_first":
            orderBy = [{ isPinned: "desc" }, { deadline: "asc" }, { id: "asc" }];
            break;
          default:
            orderBy = [{ deadline: "asc" }, { id: "asc" }];
            break;
        }

        const parsedLimit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 0)) : 0;
        const parsedPage = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
        const parsedCursor = cursorParam ? parseInt(cursorParam, 10) : NaN;

        if (parsedLimit > 0) {
          const findOptions: Record<string, any> = {
            where,
            include: {
              jadwal: {
                select: { namaMatkul: true },
              },
            },
            orderBy,
            take: parsedLimit + 1,
          };

          if (!isNaN(parsedCursor) && parsedCursor > 0) {
            findOptions.cursor = { id: parsedCursor };
            findOptions.skip = 1;
          } else if (parsedPage > 1) {
            findOptions.skip = (parsedPage - 1) * parsedLimit;
          }

          const [rawRows, totalCount] = await Promise.all([
            prisma.tugas.findMany(findOptions as any),
            prisma.tugas.count({ where }),
          ]);

          const hasMore = rawRows.length > parsedLimit;
          const sliced = hasMore ? rawRows.slice(0, parsedLimit) : rawRows;
          const formattedTasks = sliced.map(formatTaskResponse);
          const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1].id : null;
          const totalPages = Math.max(1, Math.ceil(totalCount / parsedLimit));

          return {
            formattedTasks,
            pagination: {
              page: parsedPage,
              limit: parsedLimit,
              totalCount,
              totalPages,
              hasMore,
              nextCursor,
            },
          };
        }

        const tasks = await prisma.tugas.findMany({
          where,
          include: {
            jadwal: {
              select: { namaMatkul: true },
            },
          },
          orderBy: hasFilterOrPagination ? orderBy : { deadline: "asc" },
        });

        const formattedTasks = tasks.map(formatTaskResponse);
        return {
          formattedTasks,
          pagination: {
            page: 1,
            limit: formattedTasks.length || 1,
            totalCount: formattedTasks.length,
            totalPages: 1,
            hasMore: false,
            nextCursor: null,
          },
        };
      }
    );

    return apiSuccess(
      "Daftar tugas berhasil dimuat.",
      resultPayload.formattedTasks,
      200,
      {
        tasks: resultPayload.formattedTasks,
        pagination: resultPayload.pagination,
      },
      {
        "X-Cache-Status": cacheStatus,
        "X-Total-Count": String(resultPayload.pagination.totalCount),
        "X-Has-More": String(resultPayload.pagination.hasMore),
      }
    );
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

    invalidateUserServerCache(session.userId, ["tugas", "intelligence"]);

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

    invalidateUserServerCache(session.userId, ["tugas", "intelligence"]);

    const formatted = formatTaskResponse(updated);
    return apiSuccess("Progress tugas berhasil diperbarui!", formatted, 200, { task: formatted });
  } catch (error: any) {
    console.error("PATCH /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat memperbarui tugas.", 500);
  }
}
