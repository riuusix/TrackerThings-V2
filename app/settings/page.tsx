import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { UserProfile } from "@/types";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rawUser = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  const user: UserProfile = {
    id: session.userId,
    username: rawUser?.username || session.username,
    email: rawUser?.email || session.email,
    fullName: rawUser?.fullName || null,
    phoneNumber: rawUser?.phoneNumber || null,
    profilePictureUrl: rawUser?.profilePictureUrl || null,
    securityPrompt: rawUser?.securityPrompt || null,
    createdAt: rawUser?.createdAt ? new Date(rawUser.createdAt) : new Date(),
    profileUpdatedAt: rawUser?.profileUpdatedAt ? new Date(rawUser.profileUpdatedAt) : null,
    passwordChangedAt: rawUser?.passwordChangedAt ? new Date(rawUser.passwordChangedAt) : null,
  };

  return <SettingsClient user={user} />;
}
