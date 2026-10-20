import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { formatTimeFromDate } from "@/lib/utils";
import {
  evaluateAcademicInsights,
  AcademicItem,
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

    // Parallel fetch: Ambil tugas dan jadwal ujian milik pengguna secara read-only
    const [tasks, exams] = await Promise.all([
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

    // Evaluate deterministically
    const summary = evaluateAcademicInsights(items, {
      referenceDate: refValidation.date,
      timezone: tzValidation.timezone,
      upcomingWindowDays,
    });

    return apiSuccess("Insight akademik berhasil dimuat.", summary, 200, {
      summary,
    });
  } catch (error: any) {
    console.error("GET /api/intelligence/academic exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat mengevaluasi insight akademik.", 500);
  }
}

