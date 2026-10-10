"use server";

import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createUjianAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const jenisUjian = (formData.get("jenis_ujian") as string)?.trim();
  const tanggalStr = formData.get("tanggal") as string;
  const waktuMulai = (formData.get("waktu_mulai") as string)?.trim() || null;
  const waktuSelesai = (formData.get("waktu_selesai") as string)?.trim() || null;
  const ruangan = (formData.get("ruangan") as string)?.trim() || null;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!idJadwal || !jenisUjian || !tanggalStr) {
    return { success: false, error: "Mata kuliah, jenis ujian, dan tanggal ujian wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("ujian").insert([
      {
        user_id: session.userId,
        id_jadwal: idJadwal,
        jenis_ujian: jenisUjian,
        tanggal: tanggalStr,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        ruangan,
        catatan,
      },
    ]);

    if (error) {
      return { success: false, error: "Gagal menyimpan ke Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/ujian");
    return { success: true, message: "Jadwal ujian berhasil ditambahkan!" };
  } catch (error) {
    console.error("Create ujian error:", error);
    return { success: false, error: "Gagal menambahkan jadwal ujian." };
  }
}

export async function updateUjianAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const id = parseInt(formData.get("id") as string, 10);
  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const jenisUjian = (formData.get("jenis_ujian") as string)?.trim();
  const tanggalStr = formData.get("tanggal") as string;
  const waktuMulai = (formData.get("waktu_mulai") as string)?.trim() || null;
  const waktuSelesai = (formData.get("waktu_selesai") as string)?.trim() || null;
  const ruangan = (formData.get("ruangan") as string)?.trim() || null;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!id || !idJadwal || !jenisUjian || !tanggalStr) {
    return { success: false, error: "Mata kuliah, jenis ujian, dan tanggal ujian wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("ujian")
      .update({
        id_jadwal: idJadwal,
        jenis_ujian: jenisUjian,
        tanggal: tanggalStr,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
        ruangan,
        catatan,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: "Gagal memperbarui di Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/ujian");
    return { success: true, message: "Jadwal ujian berhasil diperbarui!" };
  } catch (error) {
    console.error("Update ujian error:", error);
    return { success: false, error: "Gagal memperbarui jadwal ujian." };
  }
}

export async function deleteUjianAction(id: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("ujian").delete().eq("id", id);

    if (error) {
      return { success: false, error: "Gagal menghapus dari Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/ujian");
    return { success: true, message: "Jadwal ujian berhasil dihapus." };
  } catch (error) {
    console.error("Delete ujian error:", error);
    return { success: false, error: "Gagal menghapus jadwal ujian." };
  }
}
