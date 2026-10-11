import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: jadwal, error } = await supabase
      .from("jadwal")
      .select("*")
      .eq("user_id", session.userId)
      .order("hari", { ascending: true });

    if (error) {
      console.error("Supabase fetch jadwal error:", error);
      return NextResponse.json({ error: "Failed to fetch jadwal" }, { status: 500 });
    }

    // Kembalikan baik snake_case (Swift Codable) maupun camelCase
    const formatted = (jadwal || []).map((j: any) => ({
      id: j.id,
      user_id: j.user_id,
      userId: j.user_id,
      nama_matkul: j.nama_matkul,
      namaMatkul: j.nama_matkul,
      dosen: j.dosen,
      kategori: j.kategori,
      lokasi: j.lokasi,
      hari: j.hari,
      waktu_mulai: j.waktu_mulai,
      waktuMulai: j.waktu_mulai,
      waktu_selesai: j.waktu_selesai,
      waktuSelesai: j.waktu_selesai,
      created_at: j.created_at,
      createdAt: j.created_at,
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

    const supabase = await getSupabaseServerClient();
    const { data: newJadwal, error } = await supabase
      .from("jadwal")
      .insert([
        {
          user_id: session.userId,
          nama_matkul: namaMatkul,
          hari,
          waktu_mulai: waktuMulai,
          waktu_selesai: waktuSelesai,
          dosen,
          kategori,
          lokasi,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert jadwal error:", error);
      return NextResponse.json({ error: "Gagal menyimpan jadwal: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, jadwal: newJadwal }, { status: 201 });
  } catch (error) {
    console.error("POST /api/jadwal exception:", error);
    return NextResponse.json({ error: "Gagal membuat jadwal" }, { status: 500 });
  }
}

