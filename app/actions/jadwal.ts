"use server";

import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createJadwalAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const namaMatkul = (formData.get("nama_matkul") as string)?.trim();
  const dosen = (formData.get("dosen") as string)?.trim() || null;
  const kategori = (formData.get("kategori") as string)?.trim() || null;
  const lokasi = (formData.get("lokasi") as string)?.trim() || null;
  const hari = (formData.get("hari") as string)?.trim();
  const waktuMulai = (formData.get("waktu_mulai") as string)?.trim();
  const waktuSelesai = (formData.get("waktu_selesai") as string)?.trim();

  if (!namaMatkul || !hari || !waktuMulai || !waktuSelesai) {
    return { success: false, error: "Nama mata kuliah, hari, dan jam kuliah wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("jadwal").insert([
      {
        user_id: session.userId,
        nama_matkul: namaMatkul,
        dosen,
        kategori,
        lokasi,
        hari,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
      },
    ]);

    if (error) {
      console.error("Supabase insert jadwal error:", error);
      return { success: false, error: "Gagal menyimpan ke Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/matakuliah");
    return { success: true, message: "Mata kuliah berhasil ditambahkan!" };
  } catch (error) {
    console.error("Create jadwal error:", error);
    return { success: false, error: "Gagal menambahkan mata kuliah." };
  }
}

export async function updateJadwalAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const id = parseInt(formData.get("id") as string, 10);
  const namaMatkul = (formData.get("nama_matkul") as string)?.trim();
  const dosen = (formData.get("dosen") as string)?.trim() || null;
  const kategori = (formData.get("kategori") as string)?.trim() || null;
  const lokasi = (formData.get("lokasi") as string)?.trim() || null;
  const hari = (formData.get("hari") as string)?.trim();
  const waktuMulai = (formData.get("waktu_mulai") as string)?.trim();
  const waktuSelesai = (formData.get("waktu_selesai") as string)?.trim();

  if (!id || !namaMatkul || !hari || !waktuMulai || !waktuSelesai) {
    return { success: false, error: "Data jadwal tidak valid." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("jadwal")
      .update({
        nama_matkul: namaMatkul,
        dosen,
        kategori,
        lokasi,
        hari,
        waktu_mulai: waktuMulai,
        waktu_selesai: waktuSelesai,
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: "Gagal memperbarui di Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/matakuliah");
    return { success: true, message: "Mata kuliah berhasil diperbarui!" };
  } catch (error) {
    console.error("Update jadwal error:", error);
    return { success: false, error: "Gagal memperbarui mata kuliah." };
  }
}

export async function deleteJadwalAction(id: number) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("jadwal").delete().eq("id", id);

    if (error) {
      return { success: false, error: "Gagal menghapus dari Supabase: " + error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/matakuliah");
    return { success: true, message: "Mata kuliah berhasil dihapus." };
  } catch (error) {
    console.error("Delete jadwal error:", error);
    return { success: false, error: "Gagal menghapus mata kuliah." };
  }
}
