import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseTimeToDate, formatTimeFromDate } from "@/lib/utils";
import {
  normalizeHari,
  normalizeTime,
  deriveMappingsFromConfirmedItems,
} from "@/lib/scheduleParser";
import {
  getUserScheduleMappings,
  saveUserScheduleMappings,
} from "@/lib/scheduleCorrections";

export const dynamic = "force-dynamic";

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

    const items = Array.isArray(body.items) ? body.items : null;
    if (!items || items.length === 0) {
      return apiError("Daftar jadwal untuk diimpor tidak boleh kosong.", 400);
    }

    if (items.length > 50) {
      return apiError("Batas maksimal impor adalah 50 mata kuliah per batch.", 400);
    }

    // Validasi setiap item sebelum disimpan
    const validatedRecords: {
      userId: number;
      namaMatkul: string;
      hari: string;
      waktuMulai: Date;
      waktuSelesai: Date;
      dosen: string | null;
      kategori: string | null;
      lokasi: string | null;
      sks: number | null;
    }[] = [];

    const confirmedLearningInputs: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const rawTitle =
        typeof it.namaMatkul === "string"
          ? it.namaMatkul
          : typeof it.nama_matkul === "string"
          ? it.nama_matkul
          : "";
      const namaMatkul = rawTitle.trim();

      const rawHari = typeof it.hari === "string" ? it.hari : "";
      const hari = normalizeHari(rawHari);

      const rawStartStr =
        typeof it.waktuMulai === "string"
          ? it.waktuMulai.trim()
          : typeof it.waktu_mulai === "string"
          ? it.waktu_mulai.trim()
          : "";
      const rawEndStr =
        typeof it.waktuSelesai === "string"
          ? it.waktuSelesai.trim()
          : typeof it.waktu_selesai === "string"
          ? it.waktu_selesai.trim()
          : "";

      const waktuMulaiStr = normalizeTime(rawStartStr) || rawStartStr;
      const waktuSelesaiStr = normalizeTime(rawEndStr) || rawEndStr;

      if (!namaMatkul || namaMatkul.length < 2) {
        return apiError(`Baris #${i + 1}: Nama mata kuliah tidak valid.`, 400);
      }

      if (!hari) {
        return apiError(`Baris #${i + 1} (${namaMatkul}): Hari kuliah wajib dipilih dan valid.`, 400);
      }

      const waktuMulai = parseTimeToDate(waktuMulaiStr);
      const waktuSelesai = parseTimeToDate(waktuSelesaiStr);

      if (!waktuMulai || !waktuSelesai) {
        return apiError(
          `Baris #${i + 1} (${namaMatkul}): Format jam tidak valid (gunakan format HH:mm).`,
          400
        );
      }

      if (waktuMulaiStr >= waktuSelesaiStr) {
        return apiError(
          `Baris #${i + 1} (${namaMatkul}): Waktu selesai harus lebih lambat dari waktu mulai.`,
          400
        );
      }

      const dosen = typeof it.dosen === "string" && it.dosen.trim() ? it.dosen.trim() : null;
      const kategori =
        typeof it.kategori === "string" && it.kategori.trim() ? it.kategori.trim() : "Wajib";
      const lokasi = typeof it.lokasi === "string" && it.lokasi.trim() ? it.lokasi.trim() : null;

      let sks: number | null = null;
      if (it.sks !== null && it.sks !== undefined && it.sks !== "") {
        const parsedSks = typeof it.sks === "number" ? it.sks : parseInt(String(it.sks), 10);
        if (isNaN(parsedSks) || parsedSks < 1 || parsedSks > 8) {
          return apiError(
            `Baris #${i + 1} (${namaMatkul}): Nilai SKS tidak wajar (harus antara 1 hingga 8 SKS).`,
            400
          );
        }
        sks = parsedSks;
      }

      validatedRecords.push({
        userId: session.userId,
        namaMatkul,
        hari,
        waktuMulai,
        waktuSelesai,
        dosen,
        kategori,
        lokasi,
        sks,
      });

      confirmedLearningInputs.push({
        namaMatkul,
        hari,
        lokasi,
        sks,
        kodeMatkul: typeof it.kodeMatkul === "string" ? it.kodeMatkul.trim() : null,
        kelas: typeof it.kelas === "string" ? it.kelas.trim() : null,
        rawFields: it.rawFields && typeof it.rawFields === "object" ? it.rawFields : undefined,
      });
    }

    // Simpan semua jadwal secara atomik dalam satu transaksi
    const createdCourses = await prisma.$transaction(
      validatedRecords.map((data) => prisma.jadwal.create({ data }))
    );

    // Pelajari koreksi yang dikonfirmasi secara eksplisit oleh pengguna (hanya milik user ini)
    const learnCorrections = body.learnCorrections !== false;
    let learnedMappingsCount = 0;
    if (learnCorrections && confirmedLearningInputs.length > 0) {
      const existingMappings = await getUserScheduleMappings(session.userId);
      const updatedMappings = deriveMappingsFromConfirmedItems(
        confirmedLearningInputs,
        existingMappings
      );
      await saveUserScheduleMappings(session.userId, updatedMappings);
      learnedMappingsCount = updatedMappings.length;
    }

    const formatted = createdCourses.map((c) => ({
      id: c.id,
      userId: c.userId,
      user_id: c.userId,
      namaMatkul: c.namaMatkul,
      nama_matkul: c.namaMatkul,
      hari: c.hari,
      waktuMulai: formatTimeFromDate(c.waktuMulai),
      waktu_mulai: formatTimeFromDate(c.waktuMulai),
      waktuSelesai: formatTimeFromDate(c.waktuSelesai),
      waktu_selesai: formatTimeFromDate(c.waktuSelesai),
      dosen: c.dosen,
      kategori: c.kategori,
      lokasi: c.lokasi,
      sks: c.sks,
    }));

    return apiSuccess(
      `Berhasil mengimpor ${createdCourses.length} mata kuliah ke jadwal Anda.`,
      {
        count: createdCourses.length,
        items: formatted,
        learned_mappings_total: learnedMappingsCount,
      },
      201
    );
  } catch (err: any) {
    console.error("POST /api/jadwal/import/confirm error:", err);
    return apiError("Terjadi kesalahan saat menyimpan jadwal impor ke database.", 500);
  }
}
