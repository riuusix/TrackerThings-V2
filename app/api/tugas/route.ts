import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { nama_tugas, id_jadwal, deadline, prioritas, jenis } = body;

    if (!nama_tugas || !id_jadwal || !deadline) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newTask = await prisma.tugas.create({
      data: {
        userId: session.userId,
        idJadwal: parseInt(id_jadwal, 10),
        namaTugas: nama_tugas,
        deadline: new Date(deadline),
        prioritas: prioritas || "Sedang",
        jenis: jenis || "Individu",
      },
    });

    return NextResponse.json({ success: true, task: newTask });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, progress } = body;

    if (!id || progress === undefined) {
      return NextResponse.json({ error: "Missing task id or progress" }, { status: 400 });
    }

    const clampedProgress = Math.min(100, Math.max(0, parseInt(progress, 10)));
    const status = clampedProgress >= 100 ? "Selesai" : clampedProgress > 0 ? "Sedang Dikerjakan" : "Belum Dikerjakan";

    const updated = await prisma.tugas.update({
      where: { id: parseInt(id, 10) },
      data: { progress: clampedProgress, status },
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
