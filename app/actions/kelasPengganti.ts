"use server";

import { prisma } from "@/lib/prisma";
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

  const parsedDate = new Date(tanggalStr);
  if (isNaN(parsedDate.getTime())) {
    return { success: false, error: "Format tanggal tidak valid." };
  }

  try {
    const jadwal = await prisma.jadwal.findFirst({
      where: {
        id: idJadwal,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!jadwal) {
      return { success: false, error: "Mata kuliah tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.kelasPengganti.create({
      data: {
        userId: session.userId,
        idJadwal,
        tanggal: parsedDate,
        waktuMulai,
        waktuSelesai,
        lokasi,
        catatan,
        status: "Belum Selesai",
      },
    });

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
    const existing = await prisma.kelasPengganti.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return { success: false, error: "Kelas pengganti tidak ditemukan." };
    }

    if (existing.userId !== session.userId) {
      return { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk mengubah data ini." };
    }

    await prisma.kelasPengganti.update({
      where: { id },
      data: { status: "Selesai" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { success: true, message: "Kelas berhasil ditandai selesai dan diarsipkan!" };
  } catch (error) {
    console.error("Selesai kelas pengganti error:", error);
    return { success: false, error: "Gagal memperbarui status kelas." };
  }
}
