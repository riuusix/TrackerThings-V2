import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { JadwalGabunganItem, NotificationItem, TugasItem } from "@/types";
import { formatTimeFromDate } from "@/lib/utils";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Parallel fetch: Ambil semua data independen secara bersamaan
  const [userData, regularSchedules, replacementClasses, upcomingExamRaw, allTasks] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { username: true, email: true, fullName: true, role: true },
      }),
      prisma.jadwal.findMany({
        where: { userId: session.userId },
        orderBy: { waktuMulai: "asc" },
      }),
      prisma.kelasPengganti.findMany({
        where: {
          userId: session.userId,
          status: { not: "Selesai" },
        },
        include: {
          jadwal: {
            select: { namaMatkul: true, kategori: true },
          },
        },
        orderBy: { waktuMulai: "asc" },
      }),
      prisma.ujian.findFirst({
        where: {
          userId: session.userId,
          tanggal: { gte: todayStart },
        },
        include: {
          jadwal: {
            select: { namaMatkul: true },
          },
        },
        orderBy: [
          { tanggal: "asc" },
          { waktuMulai: "asc" },
        ],
      }),
      prisma.tugas.findMany({
        where: {
          userId: session.userId,
        },
        include: {
          jadwal: {
            select: { namaMatkul: true },
          },
        },
        orderBy: { deadline: "asc" },
      }),
    ]);

  // 1. Process user data
  let username = session.username;
  let userEmail = session.email;
  let role = session.role || "user";

  if (userData) {
    username = userData.fullName || userData.username || session.username;
    userEmail = userData.email || session.email;
    if (userData.role) {
      role = userData.role;
    }
  }

  if (session.username.toLowerCase() === "admin" || username.toLowerCase() === "admin") {
    role = "admin";
  }

  // 2. Distinct courses for dropdowns
  const uniqueCoursesMap = new Map<string, { id: number; namaMatkul: string }>();
  for (const item of regularSchedules) {
    if (!uniqueCoursesMap.has(item.namaMatkul)) {
      uniqueCoursesMap.set(item.namaMatkul, { id: item.id, namaMatkul: item.namaMatkul });
    }
  }
  const courses = Array.from(uniqueCoursesMap.values());

  // 3. Group schedules by day
  const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const schedulesByDay: Record<string, JadwalGabunganItem[]> = {};
  for (const d of DAYS) {
    schedulesByDay[d] = [];
  }

  for (const item of regularSchedules) {
    if (schedulesByDay[item.hari]) {
      schedulesByDay[item.hari].push({
        id: item.id,
        namaMatkul: item.namaMatkul,
        dosen: item.dosen,
        kategori: item.kategori,
        lokasi: item.lokasi,
        waktuMulai: formatTimeFromDate(item.waktuMulai),
        waktuSelesai: formatTimeFromDate(item.waktuSelesai),
        tipe: "reguler",
      });
    }
  }

  for (const kp of replacementClasses) {
    const classDay = DAY_NAMES[new Date(kp.tanggal).getDay()];
    if (schedulesByDay[classDay]) {
      schedulesByDay[classDay].push({
        id: kp.id,
        idJadwal: kp.idJadwal,
        namaMatkul: kp.jadwal?.namaMatkul || "Kelas Pengganti",
        kategori: kp.jadwal?.kategori,
        lokasi: kp.lokasi,
        waktuMulai: formatTimeFromDate(kp.waktuMulai),
        waktuSelesai: formatTimeFromDate(kp.waktuSelesai),
        tipe: "pengganti",
        catatan: kp.catatan,
        status: kp.status,
      });
    }
  }

  for (const d of DAYS) {
    schedulesByDay[d].sort((a, b) => a.waktuMulai.localeCompare(b.waktuMulai));
  }

  const currentDayOfWeek = DAY_NAMES[new Date().getDay()];
  const initialDay = DAYS.includes(currentDayOfWeek) ? currentDayOfWeek : "Senin";

  // 4. Process upcoming exam
  const upcomingExam = upcomingExamRaw
    ? {
        id: upcomingExamRaw.id,
        userId: upcomingExamRaw.userId,
        idJadwal: upcomingExamRaw.idJadwal,
        jenisUjian: upcomingExamRaw.jenisUjian,
        tanggal: new Date(upcomingExamRaw.tanggal),
        waktuMulai: upcomingExamRaw.waktuMulai ? formatTimeFromDate(upcomingExamRaw.waktuMulai) : null,
        waktuSelesai: upcomingExamRaw.waktuSelesai ? formatTimeFromDate(upcomingExamRaw.waktuSelesai) : null,
        ruangan: upcomingExamRaw.ruangan,
        catatan: upcomingExamRaw.catatan,
        createdAt: new Date(),
        jadwal: upcomingExamRaw.jadwal ? { namaMatkul: upcomingExamRaw.jadwal.namaMatkul } : undefined,
      }
    : null;

  // 5. Partition tasks in-memory (urgent vs completed) — ZERO duplicate database queries
  const urgentTasks: TugasItem[] = [];
  const completedTasks: TugasItem[] = [];

  for (const t of allTasks) {
    const item: TugasItem = {
      id: t.id,
      userId: t.userId,
      idJadwal: t.idJadwal,
      namaTugas: t.namaTugas,
      deadline: new Date(t.deadline),
      prioritas: t.prioritas,
      jenis: t.jenis,
      status: t.status,
      progress: t.progress,
      createdAt: new Date(),
      jadwal: t.jadwal ? { namaMatkul: t.jadwal.namaMatkul } : undefined,
    };
    if (t.status === "Selesai") {
      completedTasks.push(item);
    } else {
      urgentTasks.push(item);
    }
  }

  completedTasks.sort((a, b) => b.deadline.getTime() - a.deadline.getTime());

  // 7. Calculate urgent notifications
  const notifications: NotificationItem[] = [];
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 2);

  for (const t of urgentTasks) {
    if (t.deadline >= now && t.deadline <= tomorrow) {
      notifications.push({
        id: `task-${t.id}`,
        judul: t.namaTugas,
        namaMatkul: t.jadwal?.namaMatkul || "",
        waktu: new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(t.deadline),
        tipe: "Tugas",
        isUrgent: true,
      });
    }
  }

  return (
    <DashboardClient
      username={username}
      userEmail={userEmail}
      role={role}
      courses={courses}
      schedulesByDay={schedulesByDay}
      initialDay={initialDay}
      upcomingExam={upcomingExam as any}
      urgentTasks={urgentTasks}
      completedTasks={completedTasks}
      notifications={notifications}
    />
  );
}
