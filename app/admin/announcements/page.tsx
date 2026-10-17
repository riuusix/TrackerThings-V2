import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AnnouncementsClient } from "./AnnouncementsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Verify Admin Role strictly from database
  const currentUserData = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { username: true, email: true, role: true },
  });

  const userRole = (currentUserData?.role || "").toLowerCase();

  if (userRole !== "admin") {
    redirect("/dashboard");
  }

  const [rawAnnouncements, rawLogs] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.adminLog.findMany({ take: 10, orderBy: { timestamp: "desc" } }),
  ]);

  const announcements = rawAnnouncements.map((a) => ({
    id: Number(a.id),
    judul: a.title,
    isi: a.content,
    kategori: "Akademik",
    target: "Semua Pengguna",
    tanggal: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: (a.isActive ? "Aktif" : "Arsip") as "Aktif" | "Arsip",
    penulis: "Administrator",
  }));

  const logs = rawLogs.map((l) => ({
    id: l.id.toString(),
    action: `[${l.actionType}] @${l.adminUsername}: ${l.actionDescription}`,
    waktu: l.timestamp ? l.timestamp.toLocaleString("id-ID") : "Baru saja",
    tipe: l.actionType,
  }));

  return (
    <AnnouncementsClient
      initialAnnouncements={announcements}
      initialLogs={logs}
      currentUsername={currentUserData?.username || session.username}
      currentUserEmail={currentUserData?.email || session.email}
      role={userRole}
    />
  );
}
