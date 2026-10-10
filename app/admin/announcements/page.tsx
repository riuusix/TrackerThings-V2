import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AnnouncementsClient } from "./AnnouncementsClient";

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();

  // Verify Admin Role
  const { data: currentUserData } = await supabase
    .from("users")
    .select("username, email, role")
    .eq("id", session.userId)
    .single();

  const userRole =
    currentUserData?.role ||
    session.role ||
    (session.username.toLowerCase() === "admin" ? "admin" : "user");

  if (userRole.toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  return (
    <AnnouncementsClient
      currentUsername={currentUserData?.username || session.username}
      currentUserEmail={currentUserData?.email || session.email}
      role={userRole}
    />
  );
}
