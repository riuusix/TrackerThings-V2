import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

function formatTaskResponse(t: any) {
  if (!t) return null;
  const jadwalNama = t.jadwal?.nama_matkul || t.jadwal?.namaMatkul || null;
  return {
    id: t.id,
    user_id: t.user_id,
    userId: t.user_id,
    id_jadwal: t.id_jadwal,
    idJadwal: t.id_jadwal,
    nama_tugas: t.nama_tugas,
    namaTugas: t.nama_tugas,
    deadline: t.deadline,
    prioritas: t.prioritas,
    jenis: t.jenis,
    status: t.status,
    progress: t.progress,
    created_at: t.created_at,
    createdAt: t.created_at,
    jadwal: jadwalNama ? { nama_matkul: jadwalNama, namaMatkul: jadwalNama } : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const supabase = await getSupabaseServerClient();
    const { data: tasks, error } = await supabase
      .from("tugas")
      .select("*, jadwal:id_jadwal(nama_matkul)")
      .eq("user_id", session.userId)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Supabase fetch tugas error:", error);
      return apiError("Gagal mengambil daftar tugas dari server.", 500);
    }

    const formattedTasks = (tasks || []).map(formatTaskResponse);
    return apiSuccess("Daftar tugas berhasil dimuat.", formattedTasks, 200, { tasks: formattedTasks });
  } catch (error: any) {
    console.error("GET /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}

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

    const namaTugas = typeof body.nama_tugas === "string" 
      ? body.nama_tugas.trim() 
      : (typeof body.namaTugas === "string" ? body.namaTugas.trim() : "");

    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const deadline = body.deadline;
    const prioritas = body.prioritas || "Sedang";
    const jenis = body.jenis || "Individu";

    if (!namaTugas || isNaN(parsedJadwalId) || !deadline) {
      return apiError("Nama tugas, id_jadwal, dan deadline wajib diisi.", 400);
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return apiError("Format deadline tidak valid.", 400);
    }

    const supabase = await getSupabaseServerClient();

    // Pastikan jadwal yang dikaitkan milik pengguna yang sedang login
    const { data: jadwal, error: jadwalErr } = await supabase
      .from("jadwal")
      .select("id")
      .eq("id", parsedJadwalId)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (jadwalErr) {
      console.error("Supabase jadwal check error:", jadwalErr);
      return apiError("Gagal memverifikasi jadwal mata kuliah.", 500);
    }

    if (!jadwal) {
      return apiError("Jadwal mata kuliah tidak ditemukan atau bukan milik Anda.", 404);
    }

    const { data: newTask, error: insertError } = await supabase
      .from("tugas")
      .insert([
        {
          user_id: session.userId,
          id_jadwal: parsedJadwalId,
          nama_tugas: namaTugas,
          deadline: parsedDeadline.toISOString(),
          prioritas,
          jenis,
          status: "Belum Dikerjakan",
          progress: 0,
        },
      ])
      .select("*, jadwal:id_jadwal(nama_matkul)")
      .single();

    if (insertError) {
      console.error("Supabase insert tugas error:", insertError);
      return apiError("Gagal membuat tugas di database.", 500);
    }

    const formatted = formatTaskResponse(newTask);
    return apiSuccess("Tugas berhasil dibuat!", formatted, 201, { task: formatted });
  } catch (error: any) {
    console.error("POST /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat membuat tugas.", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const { id, progress } = body;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return apiError("ID tugas tidak valid.", 400);
    }

    if (progress === undefined || progress === null) {
      return apiError("Nilai progress wajib diisi.", 400);
    }

    const parsedProgress = parseInt(progress, 10);
    if (isNaN(parsedProgress)) {
      return apiError("Nilai progress harus berupa angka.", 400);
    }

    const supabase = await getSupabaseServerClient();

    // Periksa keberadaan tugas terlebih dahulu
    const { data: existingTask, error: fetchErr } = await supabase
      .from("tugas")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchErr) {
      console.error("Supabase fetch single tugas error:", fetchErr);
      return apiError("Gagal memeriksa tugas di database.", 500);
    }

    if (!existingTask) {
      return apiError("Tugas tidak ditemukan.", 404);
    }

    // Validasi kepemilikan tugas
    if (existingTask.user_id !== session.userId) {
      return apiError("Akses ditolak: Anda tidak memiliki izin untuk mengubah tugas ini.", 403);
    }

    const clampedProgress = Math.min(100, Math.max(0, parsedProgress));
    const status = clampedProgress >= 100 ? "Selesai" : clampedProgress > 0 ? "Sedang Dikerjakan" : "Belum Dikerjakan";

    const { data: updated, error: updateErr } = await supabase
      .from("tugas")
      .update({ progress: clampedProgress, status })
      .eq("id", taskId)
      .select("*, jadwal:id_jadwal(nama_matkul)")
      .single();

    if (updateErr) {
      console.error("Supabase update tugas error:", updateErr);
      return apiError("Gagal memperbarui progress tugas di database.", 500);
    }

    const formatted = formatTaskResponse(updated);
    return apiSuccess("Progress tugas berhasil diperbarui!", formatted, 200, { task: formatted });
  } catch (error: any) {
    console.error("PATCH /api/tugas exception:", error);
    return apiError("Terjadi kesalahan internal pada server saat memperbarui tugas.", 500);
  }
}
