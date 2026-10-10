"use server";

import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createTugasAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const namaTugas = (formData.get("nama_tugas") as string)?.trim();
  const deadlineStr = formData.get("deadline") as string;
  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const prioritas = formData.get("prioritas") as string;
  const jenis = (formData.get("jenis") as string)?.trim();

  if (!namaTugas || !deadlineStr || !idJadwal || !prioritas || !jenis) {
    return { success: false, error: "Semua kolom tugas wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("tugas").insert([
      {
        user_id: session.userId,
        id_jadwal: idJadwal,
        nama_tugas: namaTugas,
        deadline: new Date(deadlineStr).toISOString(),
        prioritas,
        jenis,
        status: "Belum Dikerjakan",
        progress: 0,
      },
    ]);

    if (error) {
      console.error("Supabase insert tugas error:", error);
      return { success: false, error: "Gagal menyimpan ke Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Tugas berhasil ditambahkan!" };
  } catch (error) {
    console.error("Create tugas error:", error);
    return { success: false, error: "Gagal menambahkan tugas." };
  }
}

export async function updateTugasAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const idTugas = parseInt(formData.get("id_tugas") as string, 10);
  const namaTugas = (formData.get("nama_tugas") as string)?.trim();
  const deadlineStr = formData.get("deadline") as string;
  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const prioritas = formData.get("prioritas") as string;
  const jenis = (formData.get("jenis") as string)?.trim();

  if (!idTugas || !namaTugas || !deadlineStr || !idJadwal || !prioritas || !jenis) {
    return { success: false, error: "Semua kolom tugas wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("tugas")
      .update({
        nama_tugas: namaTugas,
        deadline: new Date(deadlineStr).toISOString(),
        id_jadwal: idJadwal,
        prioritas,
        jenis,
      })
      .eq("id", idTugas);

    if (error) {
      return { success: false, error: "Gagal memperbarui di Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Tugas berhasil diperbarui!" };
  } catch (error) {
    console.error("Update tugas error:", error);
    return { success: false, error: "Gagal memperbarui tugas." };
  }
}

export async function updateTugasProgressAction(idTugas: number, progressVal: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progressVal)));
  let status = "Belum Dikerjakan";
  if (clampedProgress >= 100) {
    status = "Selesai";
  } else if (clampedProgress > 0) {
    status = "Sedang Dikerjakan";
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("tugas")
      .update({
        progress: clampedProgress,
        status,
      })
      .eq("id", idTugas);

    if (error) {
      return { success: false, error: "Gagal memperbarui progress: " + error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, status, progress: clampedProgress };
  } catch (error) {
    console.error("Update progress error:", error);
    return { success: false, error: "Gagal memperbarui progress tugas." };
  }
}

export async function deleteTugasAction(idTugas: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("tugas").delete().eq("id", idTugas);

    if (error) {
      return { success: false, error: "Gagal menghapus tugas: " + error.message };
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Tugas berhasil dihapus." };
  } catch (error) {
    console.error("Delete tugas error:", error);
    return { success: false, error: "Gagal menghapus tugas." };
  }
}
