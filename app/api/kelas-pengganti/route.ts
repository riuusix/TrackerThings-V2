import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await prisma.kelasPengganti.findMany({
      where: { userId: session.userId },
      include: {
        jadwal: {
          select: { namaMatkul: true, kategori: true },
        },
      },
      orderBy: { tanggal: "asc" },
    });

    const formatted = list.map((kp) => ({
      id: kp.id,
      user_id: kp.userId,
      userId: kp.userId,
      id_jadwal: kp.idJadwal,
      idJadwal: kp.idJadwal,
      tanggal: kp.tanggal instanceof Date ? kp.tanggal.toISOString() : kp.tanggal,
      waktu_mulai: kp.waktuMulai,
      waktuMulai: kp.waktuMulai,
      waktu_selesai: kp.waktuSelesai,
      waktuSelesai: kp.waktuSelesai,
      lokasi: kp.lokasi,
      catatan: kp.catatan,
      status: kp.status,
      created_at: kp.createdAt instanceof Date ? kp.createdAt.toISOString() : kp.createdAt,
      createdAt: kp.createdAt instanceof Date ? kp.createdAt.toISOString() : kp.createdAt,
      jadwal: kp.jadwal ? {
        nama_matkul: kp.jadwal.namaMatkul,
        namaMatkul: kp.jadwal.namaMatkul,
        kategori: kp.jadwal.kategori
      } : null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/kelas-pengganti exception:", error);
    return NextResponse.json({ error: "Failed to fetch kelas pengganti" }, { status: 500 });
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
    const tanggalStr = body.tanggal;
    const waktuMulai = typeof body.waktu_mulai === "string"
      ? body.waktu_mulai.trim()
      : (typeof body.waktuMulai === "string" ? body.waktuMulai.trim() : "");
    const waktuSelesai = typeof body.waktu_selesai === "string"
      ? body.waktu_selesai.trim()
      : (typeof body.waktuSelesai === "string" ? body.waktuSelesai.trim() : "");
    const lokasi = typeof body.lokasi === "string" ? body.lokasi.trim() : null;
    const catatan = typeof body.catatan === "string" ? body.catatan.trim() : null;
    const status = typeof body.status === "string" ? body.status.trim() : "Belum Selesai";

    if (isNaN(parsedJadwalId) || parsedJadwalId <= 0 || !tanggalStr || !waktuMulai || !waktuSelesai) {
      return apiError("Mata kuliah, tanggal, dan rentang waktu wajib diisi.", 400);
    }

    const parsedDate = new Date(tanggalStr);
    if (isNaN(parsedDate.getTime())) {
      return apiError("Format tanggal tidak valid.", 400);
    }

    // Verifikasi mata kuliah milik pengguna yang sedang login
    const jadwal = await prisma.jadwal.findFirst({
      where: {
        id: parsedJadwalId,
        userId: session.userId,
      },
      select: { id: true, namaMatkul: true, kategori: true },
    });

    if (!jadwal) {
      return apiError("Mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
    }

    const newKp = await prisma.kelasPengganti.create({
      data: {
        userId: session.userId,
        idJadwal: parsedJadwalId,
        tanggal: parsedDate,
        waktuMulai,
        waktuSelesai,
        lokasi,
        catatan,
        status,
      },
      include: {
        jadwal: {
          select: { namaMatkul: true, kategori: true },
        },
      },
    });

    const formatted = {
      id: newKp.id,
      user_id: newKp.userId,
      userId: newKp.userId,
      id_jadwal: newKp.idJadwal,
      idJadwal: newKp.idJadwal,
      tanggal: newKp.tanggal instanceof Date ? newKp.tanggal.toISOString() : newKp.tanggal,
      waktu_mulai: newKp.waktuMulai,
      waktuMulai: newKp.waktuMulai,
      waktu_selesai: newKp.waktuSelesai,
      waktuSelesai: newKp.waktuSelesai,
      lokasi: newKp.lokasi,
      catatan: newKp.catatan,
      status: newKp.status,
      created_at: newKp.createdAt instanceof Date ? newKp.createdAt.toISOString() : newKp.createdAt,
      createdAt: newKp.createdAt instanceof Date ? newKp.createdAt.toISOString() : newKp.createdAt,
      jadwal: newKp.jadwal ? {
        nama_matkul: newKp.jadwal.namaMatkul,
        namaMatkul: newKp.jadwal.namaMatkul,
        kategori: newKp.jadwal.kategori
      } : null,
    };

    return apiSuccess("Kelas pengganti berhasil ditambahkan!", formatted, 201, { kelas_pengganti: formatted });
  } catch (error) {
    console.error("POST /api/kelas-pengganti exception:", error);
    return apiError("Terjadi kesalahan server saat menambahkan kelas pengganti.", 500);
  }
}

