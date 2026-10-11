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
    const { data: exams, error } = await supabase
      .from("ujian")
      .select("*, jadwal:id_jadwal(nama_matkul)")
      .eq("user_id", session.userId)
      .order("tanggal", { ascending: true });

    if (error) {
      console.error("Supabase fetch ujian error:", error);
      return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
    }

    const formatted = (exams || []).map((e: any) => ({
      id: e.id,
      user_id: e.user_id,
      userId: e.user_id,
      id_jadwal: e.id_jadwal,
      idJadwal: e.id_jadwal,
      jenis_ujian: e.jenis_ujian,
      jenisUjian: e.jenis_ujian,
      tanggal: e.tanggal,
      waktu_mulai: e.waktu_mulai,
      waktuMulai: e.waktu_mulai,
      waktu_selesai: e.waktu_selesai,
      waktuSelesai: e.waktu_selesai,
      ruangan: e.ruangan,
      catatan: e.catatan,
      created_at: e.created_at,
      createdAt: e.created_at,
      jadwal: e.jadwal ? { nama_matkul: e.jadwal.nama_matkul, namaMatkul: e.jadwal.nama_matkul } : null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/ujian exception:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}

