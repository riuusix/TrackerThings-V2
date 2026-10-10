import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./ProfileClient";
import { UserProfile } from "@/types";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();

  const { data: rawUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.userId)
    .maybeSingle();

  const user: UserProfile = {
    id: session.userId,
    username: rawUser?.username || session.username,
    email: rawUser?.email || session.email,
    fullName: rawUser?.full_name || null,
    phoneNumber: rawUser?.phone_number || null,
    profilePictureUrl: rawUser?.profile_picture_url || null,
    securityPrompt: rawUser?.security_prompt || null,
    createdAt: rawUser?.created_at ? new Date(rawUser.created_at) : new Date(),
    profileUpdatedAt: rawUser?.profile_updated_at ? new Date(rawUser.profile_updated_at) : null,
    passwordChangedAt: rawUser?.password_changed_at ? new Date(rawUser.password_changed_at) : null,
  };

  const [coursesRes, tasksRes, completedRes] = await Promise.all([
    supabase.from("jadwal").select("*", { count: "exact", head: true }),
    supabase.from("tugas").select("*", { count: "exact", head: true }),
    supabase.from("tugas").select("*", { count: "exact", head: true }).eq("status", "Selesai"),
  ]);

  return (
    <ProfileClient
      user={user}
      stats={{
        totalCourses: coursesRes.count || 0,
        totalTasks: tasksRes.count || 0,
        completedTasks: completedRes.count || 0,
      }}
    />
  );
}
