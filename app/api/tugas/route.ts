import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";

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
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: tasks, error } = await supabase
      .from("tugas")
      .select("*, jadwal:id_jadwal(nama_matkul)")
      .eq("user_id", session.userId)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Supabase fetch tugas error:", error);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    const formattedTasks = (tasks || []).map(formatTaskResponse);
    return NextResponse.json({ tasks: formattedTasks });
  } catch (error) {
    console.error("GET /api/tugas exception:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
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

    const namaTugas = typeof body.nama_tugas === "string" 
      ? body.nama_tugas.trim() 
      : (typeof body.namaTugas === "string" ? body.namaTugas.trim() : "");

    const rawJadwalId = body.id_jadwal !== undefined ? body.id_jadwal : body.idJadwal;
    const parsedJadwalId = parseInt(rawJadwalId, 10);
    const deadline = body.deadline;
    const prioritas = body.prioritas || "Sedang";
    const jenis = body.jenis || "Individu";

    if (!namaTugas || isNaN(parsedJadwalId) || !deadline) {
      return NextResponse.json({ error: "Nama tugas, id_jadwal, dan deadline wajib diisi." }, { status: 400 });
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: "Format deadline tidak valid." }, { status: 400 });
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
      return NextResponse.json({ error: "Gagal memverifikasi jadwal mata kuliah" }, { status: 500 });
    }

    if (!jadwal) {
      return NextResponse.json(
        { error: "Jadwal mata kuliah tidak ditemukan atau bukan milik Anda." },
        { status: 404 }
      );
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
      return NextResponse.json({ error: "Gagal membuat tugas di database" }, { status: 500 });
    }

    return NextResponse.json({ success: true, task: formatTaskResponse(newTask) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tugas exception:", error);
    return NextResponse.json({ error: "Gagal membuat tugas" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    }

    const { id, progress } = body;
    const taskId = parseInt(id, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return NextResponse.json({ error: "ID tugas tidak valid" }, { status: 400 });
    }

    if (progress === undefined || progress === null) {
      return NextResponse.json({ error: "Nilai progress wajib diisi" }, { status: 400 });
    }

    const parsedProgress = parseInt(progress, 10);
    if (isNaN(parsedProgress)) {
      return NextResponse.json({ error: "Nilai progress harus berupa angka" }, { status: 400 });
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
      return NextResponse.json({ error: "Gagal memeriksa tugas" }, { status: 500 });
    }

    if (!existingTask) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    // Validasi kepemilikan tugas
    if (existingTask.user_id !== session.userId) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda tidak memiliki izin untuk mengubah tugas ini" },
        { status: 403 }
      );
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
      return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
    }

    return NextResponse.json({ success: true, task: formatTaskResponse(updated) });
  } catch (error) {
    console.error("PATCH /api/tugas exception:", error);
    return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
  }
}
