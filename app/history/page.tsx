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
        OR: [{ status: "Selesai" }, { tanggal: { lt: todayStart } }],
      },
      include: {
        jadwal: {
          select: { namaMatkul: true, kategori: true },
        },
      },
      orderBy: [{ tanggal: "desc" }, { waktuMulai: "desc" }],
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { profilePictureUrl: true },
    }),
  ]);

  const historyClasses = rawHistory;

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-20">
      <Navbar
        username={session.username}
        userEmail={session.email}
        role={session.role || "user"}
        profilePictureUrl={user?.profilePictureUrl}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 space-y-6">
        {/* Editorial Page Header (No Decorative Eyebrow Pill) */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
              <span className="text-accent font-semibold">Arsip Perkuliahan</span>
              <span className="text-content-muted">·</span>
              <span className="font-mono tabular-nums text-content-muted">
                {historyClasses.length} Rekaman Sesi
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
              Riwayat Kelas Pengganti
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary mt-1">
              Catatan sesi perkuliahan pengganti yang telah selesai dihadiri atau telah melewati jadwal pelaksanaan.
            </p>
          </div>
        </header>

        {/* Calm Archive Ledger */}
        {historyClasses.length === 0 ? (
          <div className="bg-surface-elevated border border-line rounded-2xl p-12 text-center shadow-2xs">
            <History className="w-10 h-10 text-content-muted mx-auto mb-3 opacity-60" />
            <h3 className="font-bold text-content-primary text-base sm:text-lg">
              Belum Ada Riwayat Kelas
            </h3>
            <p className="text-xs sm:text-sm text-content-secondary mt-1 max-w-md mx-auto">
              Kelas pengganti yang ditandai selesai di dashboard akan otomatis masuk ke dalam arsip riwayat ini.
            </p>
          </div>
        ) : (
          <section
            aria-label="Arsip Riwayat Kelas Pengganti"
            className="bg-surface-elevated border border-line rounded-2xl shadow-2xs overflow-hidden"
          >
            <div className="px-5 py-3.5 bg-surface/60 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-accent shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-content-secondary">
                  Buku Besar Arsip Sesi
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums font-semibold text-content-muted">
                Diurutkan Terbaru
              </span>
            </div>

            <div className="divide-y divide-line">
              {historyClasses.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:px-5 sm:py-4 hover:bg-surface/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                >
                  {/* Left & Center: Date/Time Rail + Course Identity */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 min-w-0 flex-1">
                    {/* Tabular Date & Time Block */}
                    <div className="sm:w-44 shrink-0 space-y-0.5 font-mono tabular-nums">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-content-primary">
                        <Calendar className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>{formatIndonesianDate(item.tanggal)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-content-secondary pl-5">
                        <Clock className="w-3 h-3 text-content-muted shrink-0" />
                        <span>
                          {formatTimeFromDate(item.waktuMulai)} –{" "}
                          {formatTimeFromDate(item.waktuSelesai)}
                        </span>
                      </div>
                    </div>

                    {/* Course Title, Room & Notes */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-content-primary truncate">
                          {item.jadwal?.namaMatkul || "Kelas Pengganti"}
                        </h3>
                        {item.jadwal?.kategori && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-medium bg-surface text-content-secondary border border-line-subtle">
                            {item.jadwal.kategori}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-secondary">
                        {item.lokasi && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-content-muted shrink-0" />
                            <span className="font-medium text-content-primary">
                              {item.lokasi}
                            </span>
                          </span>
                        )}
                        {item.catatan && (
                          <span className="text-content-muted truncate max-w-md">
                            Catatan: <strong className="font-medium text-content-secondary">{item.catatan}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Status Indicator */}
                  <div className="shrink-0 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {item.status === "Selesai" ? "Selesai Dihadiri" : "Terlewat"}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
