import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { MatakuliahClient } from "./MatakuliahClient";
import { JadwalItem } from "@/types";

export default async function MatakuliahPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();

  const { data: rawCourses } = await supabase
    .from("jadwal")
    .select("*")
    .order("hari", { ascending: true })
    .order("waktu_mulai", { ascending: true });

  const courses: JadwalItem[] = (rawCourses || []).map((c: any) => ({
    id: c.id,
    userId: c.user_id,
    namaMatkul: c.nama_matkul,
    dosen: c.dosen,
    kategori: c.kategori,
    lokasi: c.lokasi,
    hari: c.hari,
    waktuMulai: c.waktu_mulai,
    waktuSelesai: c.waktu_selesai,
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
