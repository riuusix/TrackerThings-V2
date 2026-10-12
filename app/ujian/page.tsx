import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UjianClient } from "./UjianClient";
import { formatTimeFromDate } from "@/lib/utils";

export default async function UjianPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rawCourses = await prisma.jadwal.findMany({
    where: { userId: session.userId },
    select: { id: true, namaMatkul: true },
    orderBy: { namaMatkul: "asc" },
  });

  const uniqueCoursesMap = new Map<string, { id: number; namaMatkul: string }>();
  for (const c of rawCourses) {
    if (!uniqueCoursesMap.has(c.namaMatkul)) {
      uniqueCoursesMap.set(c.namaMatkul, { id: c.id, namaMatkul: c.namaMatkul });
    }
  }
  const courses = Array.from(uniqueCoursesMap.values());

  const rawExams = await prisma.ujian.findMany({
    where: { userId: session.userId },
    include: {
      jadwal: {
        select: { namaMatkul: true },
      },
    },
    orderBy: [
      { tanggal: "asc" },
      { waktuMulai: "asc" },
    ],
  });

  const exams = rawExams.map((u) => ({
    id: u.id,
    userId: u.userId,
    idJadwal: u.idJadwal,
    jenisUjian: u.jenisUjian,
    tanggal: new Date(u.tanggal),
    waktuMulai: u.waktuMulai ? formatTimeFromDate(u.waktuMulai) : null,
    waktuSelesai: u.waktuSelesai ? formatTimeFromDate(u.waktuSelesai) : null,
    ruangan: u.ruangan,
    catatan: u.catatan,
    createdAt: new Date(),
    jadwal: u.jadwal ? { namaMatkul: u.jadwal.namaMatkul } : undefined,
  }));

  return (
    <UjianClient
      username={session.username}
      userEmail={session.email}
      initialExams={exams as any}
      courses={courses}
    />
  );
}
