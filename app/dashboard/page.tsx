import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";
import { JadwalGabunganItem, NotificationItem, TugasItem } from "@/types";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();

  // 1. Fetch user data
  let username = session.username;
  let userEmail = session.email;
  let role = session.role || "user";
  const { data: userData } = await supabase
    .from("users")
    .select("username, email, full_name, role")
    .eq("id", session.userId)
    .single();

  if (userData) {
    username = userData.full_name || userData.username || session.username;
    userEmail = userData.email || session.email;
    if ((userData as any).role) {
      role = (userData as any).role;
    }
  }

  if (session.username.toLowerCase() === "admin" || username.toLowerCase() === "admin") {
    role = "admin";
  }

  // 2. Fetch all regular schedules from Supabase
  const { data: rawJadwal } = await supabase
    .from("jadwal")
    .select("*")
    .order("waktu_mulai", { ascending: true });

  const regularSchedules = rawJadwal || [];

  // Distinct courses for dropdowns
  const uniqueCoursesMap = new Map<string, { id: number; namaMatkul: string }>();
  for (const item of regularSchedules) {
    if (!uniqueCoursesMap.has(item.nama_matkul)) {
      uniqueCoursesMap.set(item.nama_matkul, { id: item.id, namaMatkul: item.nama_matkul });
    }
  }
  const courses = Array.from(uniqueCoursesMap.values());

  // 3. Fetch active replacement classes from Supabase
  const { data: rawKP } = await supabase
    .from("kelas_pengganti")
    .select("*, jadwal:id_jadwal(nama_matkul, kategori)")
    .neq("status", "Selesai")
    .order("waktu_mulai", { ascending: true });

  const replacementClasses = rawKP || [];

  // Group schedules by day
  const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const schedulesByDay: Record<string, JadwalGabunganItem[]> = {};
  for (const d of DAYS) {
    schedulesByDay[d] = [];
  }

  for (const item of regularSchedules) {
    if (schedulesByDay[item.hari]) {
      schedulesByDay[item.hari].push({
        id: item.id,
        namaMatkul: item.nama_matkul,
        dosen: item.dosen,
        kategori: item.kategori,
        lokasi: item.lokasi,
        waktuMulai: item.waktu_mulai,
        waktuSelesai: item.waktu_selesai,
        tipe: "reguler",
      });
    }
  }

  for (const kp of replacementClasses) {
    const classDay = DAY_NAMES[new Date(kp.tanggal).getDay()];
    if (schedulesByDay[classDay]) {
      schedulesByDay[classDay].push({
        id: kp.id,
        idJadwal: kp.id_jadwal,
        namaMatkul: kp.jadwal?.nama_matkul || "Kelas Pengganti",
        kategori: kp.jadwal?.kategori,
        lokasi: kp.lokasi,
        waktuMulai: kp.waktu_mulai,
        waktuSelesai: kp.waktu_selesai,
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

  // 4. Fetch upcoming exams from Supabase
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: rawExams } = await supabase
    .from("ujian")
    .select("*, jadwal:id_jadwal(nama_matkul)")
    .gte("tanggal", todayStr)
    .order("tanggal", { ascending: true })
    .order("waktu_mulai", { ascending: true })
    .limit(1);

  const upcomingExamRaw = rawExams && rawExams.length > 0 ? rawExams[0] : null;
  const upcomingExam = upcomingExamRaw
    ? {
        id: upcomingExamRaw.id,
        userId: upcomingExamRaw.user_id,
        idJadwal: upcomingExamRaw.id_jadwal,
        jenisUjian: upcomingExamRaw.jenis_ujian,
        tanggal: new Date(upcomingExamRaw.tanggal),
        waktuMulai: upcomingExamRaw.waktu_mulai,
        waktuSelesai: upcomingExamRaw.waktu_selesai,
        ruangan: upcomingExamRaw.ruangan,
        catatan: upcomingExamRaw.catatan,
        createdAt: new Date(),
        jadwal: upcomingExamRaw.jadwal ? { namaMatkul: upcomingExamRaw.jadwal.nama_matkul } : undefined,
      }
    : null;

  // 5. Fetch urgent tasks from Supabase
  const { data: rawTasks } = await supabase
    .from("tugas")
    .select("*, jadwal:id_jadwal(nama_matkul)")
    .neq("status", "Selesai")
    .order("deadline", { ascending: true });

  const urgentTasks: TugasItem[] = (rawTasks || []).map((t: any) => ({
    id: t.id,
    userId: t.user_id,
    idJadwal: t.id_jadwal,
    namaTugas: t.nama_tugas,
    deadline: new Date(t.deadline),
    prioritas: t.prioritas,
    jenis: t.jenis,
    status: t.status,
    progress: t.progress,
    createdAt: new Date(),
    jadwal: t.jadwal ? { namaMatkul: t.jadwal.nama_matkul } : undefined,
  }));

  // 6. Fetch completed tasks from Supabase
  const { data: rawCompletedTasks } = await supabase
    .from("tugas")
    .select("*, jadwal:id_jadwal(nama_matkul)")
    .eq("status", "Selesai")
    .order("deadline", { ascending: false });

  const completedTasks: TugasItem[] = (rawCompletedTasks || []).map((t: any) => ({
    id: t.id,
    userId: t.user_id,
    idJadwal: t.id_jadwal,
    namaTugas: t.nama_tugas,
    deadline: new Date(t.deadline),
    prioritas: t.prioritas,
    jenis: t.jenis,
    status: t.status,
    progress: t.progress,
    createdAt: new Date(),
    jadwal: t.jadwal ? { namaMatkul: t.jadwal.nama_matkul } : undefined,
  }));

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
