import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { JadwalGabunganItem, NotificationItem, TugasItem } from "@/types";
import { formatTimeFromDate, getCalendarDayName, formatIndonesianDate, getDaysDifference } from "@/lib/utils";
import {
  evaluateAcademicInsights,
  type AcademicItem,
  type AcademicClassItem,
  extractCalendarDate,
} from "@/lib/intelligence/academicInsights";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const yesterdayBuffer = new Date();
  yesterdayBuffer.setDate(yesterdayBuffer.getDate() - 1);
  yesterdayBuffer.setHours(0, 0, 0, 0);

  // Parallel fetch: Ambil semua data independen secara bersamaan
  const [userData, regularSchedules, replacementClasses, upcomingExamsRaw, allTasks] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { username: true, email: true, fullName: true, role: true, profilePictureUrl: true },
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
      prisma.ujian.findMany({
        where: {
          userId: session.userId,
          tanggal: { gte: yesterdayBuffer },
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
        take: 5,
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
    const classDay = getCalendarDayName(kp.tanggal);
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
  const upcomingExamRaw = upcomingExamsRaw.find((e) => getDaysDifference(e.tanggal) >= 0) || null;
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
  for (const t of urgentTasks) {
    const daysDiff = getDaysDifference(t.deadline);
    if (daysDiff >= 0 && daysDiff <= 2) {
      notifications.push({
        id: `task-${t.id}`,
        judul: t.namaTugas,
        namaMatkul: t.jadwal?.namaMatkul || "",
        waktu: formatIndonesianDate(t.deadline),
        tipe: "Tugas",
        isUrgent: true,
      });
    }
  }

  for (const e of upcomingExamsRaw) {
    const daysDiff = getDaysDifference(e.tanggal);
    if (daysDiff >= 0 && daysDiff <= 2) {
      notifications.push({
        id: `exam-${e.id}`,
        judul: `Ujian ${e.jenisUjian}`,
        namaMatkul: e.jadwal?.namaMatkul || "",
        waktu: formatIndonesianDate(e.tanggal),
        tipe: "Ujian",
        isUrgent: daysDiff === 0 || daysDiff === 1,
      });
    }
  }

  // 8. Deterministic Academic Intelligence Synthesis
  const timezone = "Asia/Jakarta";
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const referenceDate = `${yyyy}-${mm}-${dd}`;

  const academicItems: AcademicItem[] = [
    ...urgentTasks.map((t) => ({
      id: t.id,
      title: t.namaTugas,
      courseName: t.jadwal?.namaMatkul,
      type: "tugas" as const,
      priority: t.prioritas?.toLowerCase() || "sedang",
      dueDate: extractCalendarDate(t.deadline, timezone),
      status: t.status,
    })),
    ...upcomingExamsRaw.map((e) => ({
      id: e.id,
      title: `Ujian ${e.jenisUjian}`,
      courseName: e.jadwal?.namaMatkul,
      type: "ujian" as const,
      priority: "tinggi",
      dueDate: extractCalendarDate(e.tanggal, timezone),
    })),
  ];

  const academicClasses: AcademicClassItem[] = [
    ...regularSchedules.map((s) => ({
      id: s.id,
      courseName: s.namaMatkul,
      day: s.hari,
      startTime: formatTimeFromDate(s.waktuMulai),
      endTime: formatTimeFromDate(s.waktuSelesai),
      sks: s.sks,
      type: "reguler" as const,
    })),
    ...replacementClasses.map((kp) => ({
      id: kp.id,
      courseName: kp.jadwal?.namaMatkul || "Kelas Pengganti",
      day: getCalendarDayName(kp.tanggal),
      startTime: formatTimeFromDate(kp.waktuMulai),
      endTime: formatTimeFromDate(kp.waktuSelesai),
      type: "pengganti" as const,
      date: extractCalendarDate(kp.tanggal, timezone),
    })),
  ];

  const academicSummary = evaluateAcademicInsights(
    academicItems,
    { referenceDate, timezone, upcomingWindowDays: 7 },
    { classes: academicClasses }
  );

  return (
    <DashboardClient
      username={username}
      userEmail={userEmail}
      role={role}
      profilePictureUrl={userData?.profilePictureUrl}
      courses={courses}
      schedulesByDay={schedulesByDay}
      initialDay={initialDay}
      upcomingExam={upcomingExam as any}
      urgentTasks={urgentTasks}
      completedTasks={completedTasks}
      notifications={notifications}
      academicSummary={academicSummary}
    />
  );
}
