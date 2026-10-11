import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tasks = await prisma.tugas.findMany({
      where: { userId: session.userId },
      include: {
        jadwal: { select: { namaMatkul: true } },
      },
      orderBy: { deadline: "asc" },
    });
    return NextResponse.json({ tasks });
  } catch (error) {
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

    const { nama_tugas, id_jadwal, deadline, prioritas, jenis } = body;

    const trimmedNama = typeof nama_tugas === "string" ? nama_tugas.trim() : "";
    const parsedJadwalId = parseInt(id_jadwal, 10);

    if (!trimmedNama || isNaN(parsedJadwalId) || !deadline) {
      return NextResponse.json({ error: "Nama tugas, id_jadwal, dan deadline wajib diisi." }, { status: 400 });
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      return NextResponse.json({ error: "Format deadline tidak valid." }, { status: 400 });
    }

    // Pastikan jadwal yang dikaitkan milik pengguna yang sedang login
    const jadwal = await prisma.jadwal.findFirst({
      where: {
        id: parsedJadwalId,
        userId: session.userId,
      },
    });

    if (!jadwal) {
      return NextResponse.json(
        { error: "Jadwal mata kuliah tidak ditemukan atau bukan milik Anda." },
        { status: 404 }
      );
    }

    const newTask = await prisma.tugas.create({
      data: {
        userId: session.userId,
        idJadwal: parsedJadwalId,
        namaTugas: trimmedNama,
        deadline: parsedDeadline,
        prioritas: prioritas || "Sedang",
        jenis: jenis || "Individu",
      },
    });

    return NextResponse.json({ success: true, task: newTask }, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
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

    // Periksa keberadaan tugas terlebih dahulu
    const existingTask = await prisma.tugas.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
    }

    // Validasi kepemilikan tugas
    if (existingTask.userId !== session.userId) {
      return NextResponse.json(
        { error: "Akses ditolak: Anda tidak memiliki izin untuk mengubah tugas ini" },
        { status: 403 }
      );
    }

    const clampedProgress = Math.min(100, Math.max(0, parsedProgress));
    const status = clampedProgress >= 100 ? "Selesai" : clampedProgress > 0 ? "Sedang Dikerjakan" : "Belum Dikerjakan";

    const updated = await prisma.tugas.update({
      where: { id: taskId },
      data: { progress: clampedProgress, status },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Gagal memperbarui tugas" }, { status: 500 });
  }
}
