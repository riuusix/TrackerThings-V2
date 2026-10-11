import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return apiError("ID tugas tidak valid.", 400);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
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
      return apiError("Tugas tidak ditemukan.", 404);
    }

    if (existing.user_id !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk mengubah tugas ini.", 403);
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
      return apiError("Gagal memperbarui tugas di database.", 500);
    }

    return apiSuccess("Tugas berhasil diperbarui!", null, 200);
  } catch (error) {
    console.error("PUT /api/tugas/[id] exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat memperbarui tugas.", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(req);
  if (!session) {
    return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
  }

  const taskId = parseInt(params.id, 10);
  if (isNaN(taskId) || taskId <= 0) {
    return apiError("ID tugas tidak valid.", 400);
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
      return apiError("Gagal menghapus tugas dari database.", 500);
    }

    return apiSuccess("Tugas berhasil dihapus!", null, 200);
  } catch (error) {
    console.error("DELETE /api/tugas/[id] exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat menghapus tugas.", 500);
  }
}

