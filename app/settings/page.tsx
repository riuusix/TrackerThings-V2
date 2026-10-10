import { getSession } from "@/lib/auth";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { UserProfile } from "@/types";

export default async function SettingsPage() {
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

  return <SettingsClient user={user} />;
}
