"use server";

import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createKelasPenggantiAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const tanggalStr = formData.get("tanggal") as string;
  const waktuMulai = (formData.get("waktu_mulai") as string)?.trim();
  const waktuSelesai = (formData.get("waktu_selesai") as string)?.trim();
  const lokasi = (formData.get("lokasi") as string)?.trim() || null;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!idJadwal || !tanggalStr || !waktuMulai || !waktuSelesai) {
    return { success: false, error: "Mata kuliah, tanggal, dan rentang waktu wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("kelas_pengganti").insert([
      {
        user_id: session.userId,
        id_jadwal: idJadwal,
        tanggal: tanggalStr,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        lokasi,
        catatan,
        status: "Belum Selesai",
      },
    ]);

    if (error) {
      return { success: false, error: "Gagal menyimpan ke Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { success: true, message: "Kelas pengganti berhasil ditambahkan!" };
  } catch (error) {
    console.error("Create kelas pengganti error:", error);
    return { success: false, error: "Gagal menambahkan kelas pengganti." };
  }
}

export async function selesaiKelasPenggantiAction(id: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("kelas_pengganti")
      .update({ status: "Selesai" })
      .eq("id", id);

    if (error) {
      return { success: false, error: "Gagal memperbarui status di Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { success: true, message: "Kelas berhasil ditandai selesai dan diarsipkan!" };
  } catch (error) {
    console.error("Selesai kelas pengganti error:", error);
    return { success: false, error: "Gagal memperbarui status kelas." };
  }
}
