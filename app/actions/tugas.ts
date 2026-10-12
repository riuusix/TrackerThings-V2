"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateOnly } from "@/lib/utils";

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
    // Validasi jadwal milik user yang sedang login
    const jadwal = await prisma.jadwal.findFirst({
      where: { id: idJadwal, userId: session.userId },
      select: { id: true },
    });

    if (!jadwal) {
      return { success: false, error: "Jadwal mata kuliah tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.tugas.create({
      data: {
        userId: session.userId,
        idJadwal,
        namaTugas,
        deadline: parseDateOnly(deadlineStr),
        prioritas,
        jenis,
        status: "Belum Dikerjakan",
        progress: 0,
      },
    });

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
    const existing = await prisma.tugas.findUnique({
      where: { id: idTugas },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Tugas tidak ditemukan atau bukan milik Anda." };
    }

    const jadwal = await prisma.jadwal.findFirst({
      where: { id: idJadwal, userId: session.userId },
      select: { id: true },
    });

    if (!jadwal) {
      return { success: false, error: "Jadwal mata kuliah tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.tugas.update({
      where: { id: idTugas },
      data: {
        namaTugas,
        deadline: parseDateOnly(deadlineStr),
        idJadwal,
        prioritas,
        jenis,
      },
    });

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
    const existing = await prisma.tugas.findUnique({
      where: { id: idTugas },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Tugas tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.tugas.update({
      where: { id: idTugas },
      data: {
        progress: clampedProgress,
        status,
      },
    });

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
    const existing = await prisma.tugas.findUnique({
      where: { id: idTugas },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return { success: false, error: "Tugas tidak ditemukan atau bukan milik Anda." };
    }

    await prisma.tugas.delete({
      where: { id: idTugas },
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Tugas berhasil dihapus." };
  } catch (error) {
    console.error("Delete tugas error:", error);
    return { success: false, error: "Gagal menghapus tugas." };
  }
}
