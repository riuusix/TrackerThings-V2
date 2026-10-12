import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AnnouncementsClient } from "./AnnouncementsClient";

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Verify Admin Role
  const currentUserData = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, email: true, role: true },
  });

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
