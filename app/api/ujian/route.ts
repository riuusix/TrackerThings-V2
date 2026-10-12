import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { formatTimeFromDate, parseTimeToDate, parseDateOnly } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const exams = await prisma.ujian.findMany({
      where: { userId: session.userId },
      include: {
        jadwal: {
          select: { namaMatkul: true },
        },
      },
      orderBy: { tanggal: "asc" },
    });

    const formatted = exams.map((e) => {
      const formattedMulai = e.waktuMulai ? formatTimeFromDate(e.waktuMulai) : null;
      const formattedSelesai = e.waktuSelesai ? formatTimeFromDate(e.waktuSelesai) : null;
      return {
        id: e.id,
        user_id: e.userId,
        userId: e.userId,
        id_jadwal: e.idJadwal,
        idJadwal: e.idJadwal,
        jenis_ujian: e.jenisUjian,
        jenisUjian: e.jenisUjian,
        tanggal: e.tanggal instanceof Date ? e.tanggal.toISOString() : e.tanggal,
        waktu_mulai: formattedMulai,
        waktuMulai: formattedMulai,
        waktu_selesai: formattedSelesai,
        waktuSelesai: formattedSelesai,
        ruangan: e.ruangan,
        catatan: e.catatan,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        jadwal: e.jadwal ? { nama_matkul: e.jadwal.namaMatkul, namaMatkul: e.jadwal.namaMatkul } : null,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/ujian exception:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const jenisUjian = typeof body.jenis_ujian === "string"
      ? body.jenis_ujian.trim()
      : (typeof body.jenisUjian === "string" ? body.jenisUjian.trim() : "");
    const tanggalStr = body.tanggal;
    const waktuMulai = typeof body.waktu_mulai === "string"
      ? body.waktu_mulai.trim()
      : (typeof body.waktuMulai === "string" ? body.waktuMulai.trim() : null);
    const waktuSelesai = typeof body.waktu_selesai === "string"
      ? body.waktu_selesai.trim()
      : (typeof body.waktuSelesai === "string" ? body.waktuSelesai.trim() : null);
    const ruangan = typeof body.ruangan === "string" ? body.ruangan.trim() : null;
    const catatan = typeof body.catatan === "string" ? body.catatan.trim() : null;

    if (isNaN(parsedJadwalId) || parsedJadwalId <= 0 || !jenisUjian || !tanggalStr) {
      return apiError("Mata kuliah, jenis ujian, dan tanggal ujian wajib diisi.", 400);
    }

    const parsedDate = parseDateOnly(tanggalStr);
    const parsedMulai = waktuMulai ? parseTimeToDate(waktuMulai) : null;
    const parsedSelesai = waktuSelesai ? parseTimeToDate(waktuSelesai) : null;

    // Verifikasi mata kuliah milik pengguna yang sedang login
    const jadwal = await prisma.jadwal.findFirst({
      where: {
        id: parsedJadwalId,
        userId: session.userId,
      },
      select: { id: true, namaMatkul: true },
    });

    if (!jadwal) {
      return apiError("Mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
    }

    const newUjian = await prisma.ujian.create({
      data: {
        userId: session.userId,
        idJadwal: parsedJadwalId,
        jenisUjian,
        tanggal: parsedDate,
        waktuMulai: parsedMulai,
        waktuSelesai: parsedSelesai,
        ruangan,
        catatan,
      },
      include: {
        jadwal: {
          select: { namaMatkul: true },
        },
      },
    });

    const formattedMulai = newUjian.waktuMulai ? formatTimeFromDate(newUjian.waktuMulai) : null;
    const formattedSelesai = newUjian.waktuSelesai ? formatTimeFromDate(newUjian.waktuSelesai) : null;

    const formatted = {
      id: newUjian.id,
      user_id: newUjian.userId,
      userId: newUjian.userId,
      id_jadwal: newUjian.idJadwal,
      idJadwal: newUjian.idJadwal,
      jenis_ujian: newUjian.jenisUjian,
      jenisUjian: newUjian.jenisUjian,
      tanggal: newUjian.tanggal instanceof Date ? newUjian.tanggal.toISOString() : newUjian.tanggal,
      waktu_mulai: formattedMulai,
      waktuMulai: formattedMulai,
      waktu_selesai: formattedSelesai,
      waktuSelesai: formattedSelesai,
      ruangan: newUjian.ruangan,
      catatan: newUjian.catatan,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      jadwal: newUjian.jadwal ? { nama_matkul: newUjian.jadwal.namaMatkul, namaMatkul: newUjian.jadwal.namaMatkul } : null,
    };

    return apiSuccess("Jadwal ujian berhasil ditambahkan!", formatted, 201, { ujian: formatted });
  } catch (error) {
    console.error("POST /api/ujian exception:", error);
    return apiError("Terjadi kesalahan server saat menambahkan jadwal ujian.", 500);
  }
}

