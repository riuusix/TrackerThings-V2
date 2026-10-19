import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { formatIndonesianDate, formatTimeFromDate } from "@/lib/utils";
import { History, Calendar, Clock, MapPin, CheckCircle2 } from "lucide-react";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [rawHistory, user] = await Promise.all([
    prisma.kelasPengganti.findMany({
      where: {
        userId: session.userId,
        OR: [
          { status: "Selesai" },
          { tanggal: { lt: todayStart } },
        ],
      },
      include: {
        jadwal: {
          select: { namaMatkul: true, kategori: true },
        },
      },
      orderBy: [
        { tanggal: "desc" },
        { waktuMulai: "desc" },
      ],
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { profilePictureUrl: true },
    }),
  ]);

  const historyClasses = rawHistory;

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-16">
      <Navbar
        username={session.username}
        userEmail={session.email}
        profilePictureUrl={user?.profilePictureUrl}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="pb-2 border-b border-line">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle">
              Arsip Perkuliahan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Riwayat Kelas Pengganti
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Daftar sesi perkuliahan pengganti yang telah selesai dihadiri atau telah berlalu.
          </p>
        </div>

        {/* History List */}
        <div className="space-y-4">
          {historyClasses.length === 0 ? (
            <div className="bg-surface-elevated border border-line rounded-2xl p-12 text-center shadow-xs">
              <History className="w-12 h-12 text-content-muted mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-content-primary text-lg">
                Belum Ada Riwayat Kelas
              </h3>
              <p className="text-sm text-content-secondary mt-1 max-w-md mx-auto">
                Kelas pengganti yang ditandai selesai di dashboard akan otomatis masuk ke dalam arsip riwayat ini.
              </p>
            </div>
          ) : (
            historyClasses.map((item) => (
              <div
                key={item.id}
                className="bg-surface-elevated border border-line hover:border-line-strong rounded-2xl p-5 hover:shadow-md transition-all duration-200 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.status === "Selesai" ? "Selesai Dihadiri" : "Terlewat"}
                      </span>

                      {item.jadwal?.kategori && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-surface text-content-secondary border border-line-subtle">
                          {item.jadwal.kategori}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-content-primary">
                      {item.jadwal?.namaMatkul || "Kelas Pengganti"}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs sm:text-sm text-content-secondary">
                    <Calendar className="w-4 h-4 text-content-muted" />
                    <span>{formatIndonesianDate(item.tanggal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-content-secondary mt-3 pt-3 border-t border-line">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent shrink-0" />
                    <span>
                      {formatTimeFromDate(item.waktuMulai)} - {formatTimeFromDate(item.waktuSelesai)}
                    </span>
                  </div>

                  {item.lokasi && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{item.lokasi}</span>
                    </div>
                  )}

                  {item.catatan && (
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-surface border border-line text-xs text-content-secondary">
                      <strong className="text-content-primary">Catatan:</strong> {item.catatan}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
