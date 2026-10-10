import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { UsersManagementClient } from "./UsersManagementClient";

export default async function AdminUsersPage() {
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

  // Fetch all users
  const { data: rawUsers } = await supabase
    .from("users")
    .select("id, username, email, full_name, phone_number, role, created_at")
    .order("created_at", { ascending: false });

  const users = rawUsers || [];

  return (
    <UsersManagementClient
      initialUsers={users as any}
      currentUsername={currentUserData?.username || session.username}
      currentUserEmail={currentUserData?.email || session.email}
      role={userRole}
    />
  );
}
