import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminNavbar } from "@/components/AdminNavbar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?from=/admin");
  }

  // Strict server-side verification from trusted database record
  const currentUserData = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, email: true, role: true },
  });

  const userRole = (currentUserData?.role || "").toLowerCase();
  if (userRole !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <AdminNavbar
        currentUsername={currentUserData?.username || session.username}
        currentUserEmail={currentUserData?.email || session.email}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

