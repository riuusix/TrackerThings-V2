import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UsersManagementClient } from "./UsersManagementClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Verify Admin Role and fetch users concurrently
  const [currentUserData, rawUsers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true, email: true, role: true },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userRole =
    currentUserData?.role ||
    session.role ||
    (session.username.toLowerCase() === "admin" ? "admin" : "user");

  if (userRole.toLowerCase() !== "admin") {
    redirect("/dashboard");
  }

  const users = rawUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    full_name: u.fullName,
    phone_number: u.phoneNumber,
    role: u.role,
    created_at: u.createdAt.toISOString(),
  }));

  return (
    <UsersManagementClient
      initialUsers={users as any}
      currentUsername={currentUserData?.username || session.username}
      currentUserEmail={currentUserData?.email || session.email}
      role={userRole}
    />
  );
}
