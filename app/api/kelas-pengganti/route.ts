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
    const { data: list, error } = await supabase
      .from("kelas_pengganti")
      .select("*, jadwal:id_jadwal(nama_matkul, kategori)")
      .eq("user_id", session.userId)
      .order("tanggal", { ascending: true });

    if (error) {
      console.error("Supabase fetch kelas_pengganti error:", error);
      return NextResponse.json({ error: "Failed to fetch kelas pengganti" }, { status: 500 });
    }

    const formatted = (list || []).map((kp: any) => ({
      id: kp.id,
      user_id: kp.user_id,
      userId: kp.user_id,
      id_jadwal: kp.id_jadwal,
      idJadwal: kp.id_jadwal,
      tanggal: kp.tanggal,
      waktu_mulai: kp.waktu_mulai,
      waktuMulai: kp.waktu_mulai,
      waktu_selesai: kp.waktu_selesai,
      waktuSelesai: kp.waktu_selesai,
      lokasi: kp.lokasi,
      catatan: kp.catatan,
      status: kp.status,
      created_at: kp.created_at,
      createdAt: kp.created_at,
      jadwal: kp.jadwal ? { 
        nama_matkul: kp.jadwal.nama_matkul, 
        namaMatkul: kp.jadwal.nama_matkul,
        kategori: kp.jadwal.kategori 
      } : null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/kelas-pengganti exception:", error);
    return NextResponse.json({ error: "Failed to fetch kelas pengganti" }, { status: 500 });
  }
}

