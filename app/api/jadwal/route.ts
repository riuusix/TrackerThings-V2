import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { formatTimeFromDate, parseTimeToDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  try {
    const jadwal = await prisma.jadwal.findMany({
      where: { userId: session.userId },
      orderBy: { hari: "asc" },
    });

    // Kembalikan baik snake_case (Swift Codable) maupun camelCase
    const formatted = jadwal.map((j) => {
      const formattedMulai = formatTimeFromDate(j.waktuMulai);
      const formattedSelesai = formatTimeFromDate(j.waktuSelesai);
      return {
        id: j.id,
        user_id: j.userId,
        userId: j.userId,
        nama_matkul: j.namaMatkul,
        namaMatkul: j.namaMatkul,
        dosen: j.dosen,
        kategori: j.kategori,
        lokasi: j.lokasi,
        hari: j.hari,
        waktu_mulai: formattedMulai,
        waktuMulai: formattedMulai,
        waktu_selesai: formattedSelesai,
        waktuSelesai: formattedSelesai,
        sks: j.sks,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    });

    return apiSuccess(
      "Daftar jadwal perkuliahan berhasil dimuat.",
      formatted,
      200,
      { jadwal: formatted },
      { "x-app-version": "2.0.1-native-time" }
    );
  } catch (error) {
    console.error("GET /api/jadwal exception:", error);
    return apiError("Gagal memuat jadwal perkuliahan.", 500);
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

    const namaMatkul = typeof body.nama_matkul === "string" ? body.nama_matkul.trim() : (typeof body.namaMatkul === "string" ? body.namaMatkul.trim() : "");
    const hari = typeof body.hari === "string" ? body.hari.trim() : "";
    const waktuMulaiStr = typeof body.waktu_mulai === "string" ? body.waktu_mulai.trim() : (typeof body.waktuMulai === "string" ? body.waktuMulai.trim() : "");
    const waktuSelesaiStr = typeof body.waktu_selesai === "string" ? body.waktu_selesai.trim() : (typeof body.waktuSelesai === "string" ? body.waktuSelesai.trim() : "");
    const dosen = typeof body.dosen === "string" ? body.dosen.trim() : null;
    const kategori = typeof body.kategori === "string" ? body.kategori.trim() : null;
    const lokasi = typeof body.lokasi === "string" ? body.lokasi.trim() : null;

    if (!namaMatkul || !hari || !waktuMulaiStr || !waktuSelesaiStr) {
      return apiError("Nama matkul, hari, waktu mulai, dan waktu selesai wajib diisi.", 400);
    }

    const waktuMulai = parseTimeToDate(waktuMulaiStr);
    const waktuSelesai = parseTimeToDate(waktuSelesaiStr);

    if (!waktuMulai || !waktuSelesai) {
      return apiError("Format jam kuliah tidak valid (gunakan format HH:mm).", 400);
    }

    const newJadwal = await prisma.jadwal.create({
      data: {
        userId: session.userId,
        namaMatkul,
        hari,
        waktuMulai,
        waktuSelesai,
        dosen,
        kategori,
        lokasi,
      },
    });

    const formattedMulai = formatTimeFromDate(newJadwal.waktuMulai);
    const formattedSelesai = formatTimeFromDate(newJadwal.waktuSelesai);

    const formatted = {
      id: newJadwal.id,
      user_id: newJadwal.userId,
      userId: newJadwal.userId,
      nama_matkul: newJadwal.namaMatkul,
      namaMatkul: newJadwal.namaMatkul,
      dosen: newJadwal.dosen,
      kategori: newJadwal.kategori,
      lokasi: newJadwal.lokasi,
      hari: newJadwal.hari,
      waktu_mulai: formattedMulai,
      waktuMulai: formattedMulai,
      waktu_selesai: formattedSelesai,
      waktuSelesai: formattedSelesai,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return apiSuccess("Jadwal perkuliahan berhasil dibuat!", formatted, 201, { jadwal: formatted });
  } catch (error: any) {
    console.error("POST /api/jadwal exception:", error);
    return apiError("Gagal membuat jadwal perkuliahan.", 500);
  }
}

