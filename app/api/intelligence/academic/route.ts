import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { formatTimeFromDate, getCalendarDayName } from "@/lib/utils";
import {
  evaluateAcademicInsights,
  type AcademicItem,
  type AcademicClassItem,
  extractCalendarDate,
  validateReferenceDate,
  validateTimezone,
} from "@/lib/intelligence/academicInsights";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { searchParams } = new URL(req.url);
    const rawRefDate = searchParams.get("referenceDate");
    const rawTimezone = searchParams.get("timezone");
    const rawUpcomingWindow = searchParams.get("upcomingWindowDays");

    if (!rawRefDate || !rawTimezone) {
      return apiError(
        "Parameter 'referenceDate' (format: YYYY-MM-DD) dan 'timezone' (contoh: Asia/Jakarta) wajib disertakan secara eksplisit.",
        400
      );
    }

    const refValidation = validateReferenceDate(rawRefDate);
    if (!refValidation.valid) {
      return apiError(refValidation.error, 400);
    }

    const tzValidation = validateTimezone(rawTimezone);
    if (!tzValidation.valid) {
      return apiError(tzValidation.error, 400);
    }

    let upcomingWindowDays = 7;
    if (rawUpcomingWindow) {
      const parsedWindow = parseInt(rawUpcomingWindow, 10);
      if (!isNaN(parsedWindow) && parsedWindow >= 1 && parsedWindow <= 30) {
        upcomingWindowDays = parsedWindow;
      }
    }

    // Parallel fetch: Ambil tugas, ujian, jadwal kuliah reguler, dan kelas pengganti milik pengguna secara read-only
    const [tasks, exams, regularSchedules, replacementClasses] = await Promise.all([
      prisma.tugas.findMany({
        where: { userId: session.userId },
        include: {
          jadwal: {
            select: { namaMatkul: true },
          },
        },
        orderBy: { deadline: "asc" },
      }),
      prisma.ujian.findMany({
        where: { userId: session.userId },
        include: {
          jadwal: {
            select: { namaMatkul: true },
          },
        },
        orderBy: [
          { tanggal: "asc" },
          { waktuMulai: "asc" },
        ],
      }),
      prisma.jadwal.findMany({
        where: { userId: session.userId },
        orderBy: { waktuMulai: "asc" },
      }),
      prisma.kelasPengganti.findMany({
        where: {
          userId: session.userId,
          status: { not: "Selesai" },
        },
        include: {
          jadwal: {
            select: { namaMatkul: true },
          },
        },
        orderBy: { waktuMulai: "asc" },
      }),
    ]);

    // Map Prisma models to pure AcademicItem representations
    const items: AcademicItem[] = [
      ...tasks.map((t) => ({
        id: t.id,
        type: "tugas" as const,
        title: t.namaTugas,
        courseName: t.jadwal?.namaMatkul ?? null,
        date: t.deadline,
        status: t.status,
        priority: t.prioritas,
      })),
      ...exams.map((e) => ({
        id: e.id,
        type: "ujian" as const,
        title: e.jenisUjian,
        courseName: e.jadwal?.namaMatkul ?? null,
        date: e.tanggal,
        time: e.waktuMulai ? formatTimeFromDate(e.waktuMulai) : null,
        priority: "Tinggi",
      })),
    ];

    // Map regular & replacement schedules to AcademicClassItem representations
    const classes: AcademicClassItem[] = [
      ...regularSchedules.map((j) => ({
        id: j.id,
        courseName: j.namaMatkul,
        day: j.hari,
        startTime: formatTimeFromDate(j.waktuMulai),
        endTime: formatTimeFromDate(j.waktuSelesai),
        sks: j.sks,
        type: "reguler" as const,
      })),
      ...replacementClasses.map((kp) => ({
        id: kp.id,
        courseName: kp.jadwal?.namaMatkul || "Kelas Pengganti",
        day: getCalendarDayName(kp.tanggal),
        startTime: formatTimeFromDate(kp.waktuMulai),
        endTime: formatTimeFromDate(kp.waktuSelesai),
        type: "pengganti" as const,
        date: extractCalendarDate(kp.tanggal, tzValidation.timezone),
      })),
    ];

    // Evaluate deterministically with classes context
    const summary = evaluateAcademicInsights(
      items,
      {
        referenceDate: refValidation.date,
        timezone: tzValidation.timezone,
        upcomingWindowDays,
      },
      { classes }
    );

    return apiSuccess("Insight akademik berhasil dimuat.", summary, 200, {
      summary,
    });
  } catch (error: any) {
    console.error("GET /api/intelligence/academic exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat mengevaluasi insight akademik.", 500);
  }
}

