import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { UjianClient } from "./UjianClient";

export default async function UjianPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();

  const { data: rawCourses } = await supabase
    .from("jadwal")
    .select("id, nama_matkul")
    .order("nama_matkul", { ascending: true });

  const uniqueCoursesMap = new Map<string, { id: number; namaMatkul: string }>();
  for (const c of rawCourses || []) {
    if (!uniqueCoursesMap.has(c.nama_matkul)) {
      uniqueCoursesMap.set(c.nama_matkul, { id: c.id, namaMatkul: c.nama_matkul });
    }
  }
  const courses = Array.from(uniqueCoursesMap.values());

  const { data: rawExams } = await supabase
    .from("ujian")
    .select("*, jadwal:id_jadwal(nama_matkul)")
    .order("tanggal", { ascending: true })
    .order("waktu_mulai", { ascending: true });

  const exams = (rawExams || []).map((u: any) => ({
    id: u.id,
    userId: u.user_id,
    idJadwal: u.id_jadwal,
    jenisUjian: u.jenis_ujian,
    tanggal: new Date(u.tanggal),
    waktuMulai: u.waktu_mulai,
    waktuSelesai: u.waktu_selesai,
    ruangan: u.ruangan,
    catatan: u.catatan,
    createdAt: new Date(),
    jadwal: u.jadwal ? { namaMatkul: u.jadwal.nama_matkul } : undefined,
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
