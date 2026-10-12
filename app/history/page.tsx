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

  const rawHistory = await prisma.kelasPengganti.findMany({
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
  });

  const historyClasses = rawHistory;

  return (
    <div className="min-h-screen pb-16">
      <Navbar
        username={session.username}
        userEmail={session.email}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Arsip Perkuliahan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Riwayat Kelas Pengganti
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Daftar sesi perkuliahan pengganti yang telah selesai dihadiri atau telah berlalu.
          </p>
        </div>

        {/* History List */}
        <div className="space-y-4">
          {historyClasses.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <History className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">
                Belum Ada Riwayat Kelas
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Kelas pengganti yang ditandai selesai di dashboard akan otomatis masuk ke dalam arsip riwayat ini.
              </p>
            </div>
          ) : (
            historyClasses.map((item) => (
              <div
                key={item.id}
                className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all duration-200 border border-white/60 dark:border-white/10"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.status === "Selesai" ? "Selesai Dihadiri" : "Terlewat"}
                      </span>

                      {item.jadwal?.kategori && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.jadwal.kategori}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {item.jadwal?.namaMatkul || "Kelas Pengganti"}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{formatIndonesianDate(item.tanggal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
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
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                      <strong>Catatan:</strong> {item.catatan}
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
