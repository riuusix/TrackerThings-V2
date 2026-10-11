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

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "ID tugas tidak valid" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    }

    const namaTugas = typeof body.nama_tugas === "string" ? body.nama_tugas.trim() : (typeof body.namaTugas === "string" ? body.namaTugas.trim() : "");
    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const deadline = body.deadline;
    const prioritas = body.prioritas || "Sedang";
    const jenis = body.jenis || "Individu";

    const supabase = await getSupabaseServerClient();

    // Pastikan tugas milik user
    const { data: existing, error: checkErr } = await supabase
      .from("tugas")
      .select("id, user_id")
      .eq("id", taskId)
      .maybeSingle();

    if (checkErr || !existing) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    if (existing.user_id !== session.userId) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const updateData: any = {
      prioritas,
      jenis,
    };
    if (namaTugas) updateData.nama_tugas = namaTugas;
    if (!isNaN(parsedJadwalId) && parsedJadwalId > 0) updateData.id_jadwal = parsedJadwalId;
    if (deadline) updateData.deadline = new Date(deadline).toISOString();

    const { error: updateErr } = await supabase
      .from("tugas")
      .update(updateData)
      .eq("id", taskId);

    if (updateErr) {
      console.error("Supabase update tugas error:", updateErr);
      return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Tugas berhasil diperbarui" });
  } catch (error) {
    console.error("PUT /api/tugas/[id] exception:", error);
    return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
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

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "ID tugas tidak valid" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();

    const { error } = await supabase
      .from("tugas")
      .delete()
      .eq("id", taskId)
      .eq("user_id", session.userId);

    if (error) {
      console.error("Supabase delete tugas error:", error);
      return NextResponse.json({ error: "Gagal menghapus tugas" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Tugas berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/tugas/[id] exception:", error);
    return NextResponse.json({ error: "Gagal menghapus tugas" }, { status: 500 });
  }
}

