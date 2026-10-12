import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jadwal = await prisma.jadwal.findMany({
      where: { userId: session.userId },
      orderBy: { hari: "asc" },
    });

    // Kembalikan baik snake_case (Swift Codable) maupun camelCase
    const formatted = jadwal.map((j) => ({
      id: j.id,
      user_id: j.userId,
      userId: j.userId,
      nama_matkul: j.namaMatkul,
      namaMatkul: j.namaMatkul,
      dosen: j.dosen,
      kategori: j.kategori,
      lokasi: j.lokasi,
      hari: j.hari,
      waktu_mulai: j.waktuMulai,
      waktuMulai: j.waktuMulai,
      waktu_selesai: j.waktuSelesai,
      waktuSelesai: j.waktuSelesai,
      sks: j.sks,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/jadwal exception:", error);
    return NextResponse.json({ error: "Failed to fetch jadwal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    }

    const namaMatkul = typeof body.nama_matkul === "string" ? body.nama_matkul.trim() : (typeof body.namaMatkul === "string" ? body.namaMatkul.trim() : "");
    const hari = typeof body.hari === "string" ? body.hari.trim() : "";
    const waktuMulai = typeof body.waktu_mulai === "string" ? body.waktu_mulai.trim() : (typeof body.waktuMulai === "string" ? body.waktuMulai.trim() : "");
    const waktuSelesai = typeof body.waktu_selesai === "string" ? body.waktu_selesai.trim() : (typeof body.waktuSelesai === "string" ? body.waktuSelesai.trim() : "");
    const dosen = typeof body.dosen === "string" ? body.dosen.trim() : null;
    const kategori = typeof body.kategori === "string" ? body.kategori.trim() : null;
    const lokasi = typeof body.lokasi === "string" ? body.lokasi.trim() : null;

    if (!namaMatkul || !hari || !waktuMulai || !waktuSelesai) {
      return NextResponse.json({ error: "Nama matkul, hari, waktu mulai, dan waktu selesai wajib diisi" }, { status: 400 });
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
      waktu_mulai: newJadwal.waktuMulai,
      waktuMulai: newJadwal.waktuMulai,
      waktu_selesai: newJadwal.waktuSelesai,
      waktuSelesai: newJadwal.waktuSelesai,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, jadwal: formatted }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/jadwal exception:", error);
    return NextResponse.json({ error: "Gagal membuat jadwal" }, { status: 500 });
  }
}

