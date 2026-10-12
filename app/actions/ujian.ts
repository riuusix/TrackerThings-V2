"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateOnly, parseTimeToDate } from "@/lib/utils";

export async function createUjianAction(formData: FormData) {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const idJadwal = parseInt(formData.get("id_jadwal") as string, 10);
  const jenisUjian = (formData.get("jenis_ujian") as string)?.trim();
  const tanggalStr = formData.get("tanggal") as string;
  const waktuMulaiStr = (formData.get("waktu_mulai") as string)?.trim() || null;
  const waktuSelesaiStr = (formData.get("waktu_selesai") as string)?.trim() || null;
  const ruangan = (formData.get("ruangan") as string)?.trim() || null;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!idJadwal || !jenisUjian || !tanggalStr) {
    return { success: false, error: "Mata kuliah, jenis ujian, dan tanggal ujian wajib diisi." };
  }

  const parsedDate = parseDateOnly(tanggalStr);
  const waktuMulai = waktuMulaiStr ? parseTimeToDate(waktuMulaiStr) : null;
  const waktuSelesai = waktuSelesaiStr ? parseTimeToDate(waktuSelesaiStr) : null;

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

    await prisma.ujian.create({
      data: {
        userId: session.userId,
        idJadwal,
        jenisUjian,
        tanggal: parsedDate,
        waktuMulai,
        waktuSelesai,
        ruangan,
        catatan,
      },
    });

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
  const waktuMulaiStr = (formData.get("waktu_mulai") as string)?.trim() || null;
  const waktuSelesaiStr = (formData.get("waktu_selesai") as string)?.trim() || null;
  const ruangan = (formData.get("ruangan") as string)?.trim() || null;
  const catatan = (formData.get("catatan") as string)?.trim() || null;

  if (!id || !idJadwal || !jenisUjian || !tanggalStr) {
    return { success: false, error: "Mata kuliah, jenis ujian, dan tanggal ujian wajib diisi." };
  }

  const parsedDate = parseDateOnly(tanggalStr);
  const waktuMulai = waktuMulaiStr ? parseTimeToDate(waktuMulaiStr) : null;
  const waktuSelesai = waktuSelesaiStr ? parseTimeToDate(waktuSelesaiStr) : null;

  try {
    const existing = await prisma.ujian.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return { success: false, error: "Jadwal ujian tidak ditemukan." };
    }

    if (existing.userId !== session.userId) {
      return { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk mengubah data ini." };
    }

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

    await prisma.ujian.update({
      where: { id },
      data: {
        idJadwal,
        jenisUjian,
        tanggal: parsedDate,
        waktuMulai,
        waktuSelesai,
        ruangan,
        catatan,
      },
    });

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
    const existing = await prisma.ujian.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return { success: false, error: "Jadwal ujian tidak ditemukan." };
    }

    if (existing.userId !== session.userId) {
      return { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk menghapus data ini." };
    }

    await prisma.ujian.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/ujian");
    return { success: true, message: "Jadwal ujian berhasil dihapus." };
  } catch (error) {
    console.error("Delete ujian error:", error);
    return { success: false, error: "Gagal menghapus jadwal ujian." };
  }
}
