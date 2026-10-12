"use server";

import { prisma } from "@/lib/prisma";
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
    await prisma.jadwal.create({
      data: {
        userId: session.userId,
        namaMatkul,
        dosen,
        kategori,
        lokasi,
        hari,
        waktuMulai,
        waktuSelesai,
      },
    });

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
    const existing = await prisma.jadwal.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Mata kuliah tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.jadwal.update({
      where: { id },
      data: {
        namaMatkul,
        dosen,
        kategori,
        lokasi,
        hari,
        waktuMulai,
        waktuSelesai,
      },
    });

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
    const existing = await prisma.jadwal.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Mata kuliah tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.jadwal.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/matakuliah");
    return { success: true, message: "Mata kuliah berhasil dihapus." };
  } catch (error) {
    console.error("Delete jadwal error:", error);
    return { success: false, error: "Gagal menghapus mata kuliah." };
  }
}
