import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jadwalId = parseInt(params.id, 10);
  if (isNaN(jadwalId) || jadwalId <= 0) {
    return NextResponse.json({ error: "ID jadwal tidak valid" }, { status: 400 });
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

    const updateData: any = {};
    if (namaMatkul) updateData.nama_matkul = namaMatkul;
    if (hari) updateData.hari = hari;
    if (waktuMulai) updateData.waktu_mulai = waktuMulai;
    if (waktuSelesai) updateData.waktu_selesai = waktuSelesai;
    if (body.dosen !== undefined) updateData.dosen = body.dosen;
    if (body.kategori !== undefined) updateData.kategori = body.kategori;
    if (body.lokasi !== undefined) updateData.lokasi = body.lokasi;

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("jadwal")
      .update(updateData)
      .eq("id", jadwalId)
      .eq("user_id", session.userId);

    if (error) {
      console.error("Supabase update jadwal error:", error);
      return NextResponse.json({ error: "Gagal memperbarui jadwal" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Jadwal berhasil diperbarui" });
  } catch (error) {
    console.error("PUT /api/jadwal/[id] exception:", error);
    return NextResponse.json({ error: "Gagal memperbarui jadwal" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jadwalId = parseInt(params.id, 10);
  if (isNaN(jadwalId) || jadwalId <= 0) {
    return NextResponse.json({ error: "ID jadwal tidak valid" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("jadwal")
      .delete()
      .eq("id", jadwalId)
      .eq("user_id", session.userId);

    if (error) {
      console.error("Supabase delete jadwal error:", error);
      return NextResponse.json({ error: "Gagal menghapus jadwal" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Jadwal berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/jadwal/[id] exception:", error);
    return NextResponse.json({ error: "Gagal menghapus jadwal" }, { status: 500 });
  }
}

