import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MatakuliahClient } from "./MatakuliahClient";
import { JadwalItem } from "@/types";

export default async function MatakuliahPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rawCourses = await prisma.jadwal.findMany({
    where: { userId: session.userId },
    orderBy: [
      { hari: "asc" },
      { waktuMulai: "asc" },
    ],
  });

  const courses: JadwalItem[] = rawCourses.map((c) => ({
    id: c.id,
    userId: c.userId,
    namaMatkul: c.namaMatkul,
    dosen: c.dosen,
    kategori: c.kategori,
    lokasi: c.lokasi,
    hari: c.hari,
    waktuMulai: c.waktuMulai,
    waktuSelesai: c.waktuSelesai,
    createdAt: new Date(),
  }));

  return (
    <MatakuliahClient
      username={session.username}
      userEmail={session.email}
      initialCourses={courses}
    />
  );
}
