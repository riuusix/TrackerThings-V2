"use client";

import { useTransition } from "react";
import { Clock, MapPin, UserCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { JadwalGabunganItem } from "@/types";
import { selesaiKelasPenggantiAction } from "@/app/actions/kelasPengganti";

interface ScheduleCardProps {
  item: JadwalGabunganItem;
}

export function ScheduleCard({ item }: ScheduleCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelesai = () => {
    if (!confirm("Selesaikan kelas pengganti ini dan pindahkan ke riwayat?")) return;
    startTransition(async () => {
      await selesaiKelasPenggantiAction(item.id);
    });
  };

  const isPengganti = item.tipe === "pengganti";

  return (
    <div
      className={`group relative rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md dark:hover:border-slate-700 ${
        isPengganti
          ? "border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-r from-amber-50/40 dark:from-amber-950/20 to-white dark:to-slate-900/60"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {isPengganti ? (
              <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Kelas Pengganti
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                Reguler
              </span>
            )}

            {item.kategori && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                {item.kategori}
              </span>
            )}
          </div>

          <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {item.namaMatkul}
          </h4>
        </div>

        {isPengganti && (
          <button
            type="button"
            onClick={handleSelesai}
            disabled={isPending}
            title="Tandai Kelas Selesai"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 transition-all font-semibold active:scale-95"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Selesai</span>
          </button>
        )}
      </div>

      {/* Course Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {item.waktuMulai} - {item.waktuSelesai}
          </span>
        </div>

        {item.lokasi && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="truncate text-slate-600 dark:text-slate-300">{item.lokasi}</span>
          </div>
        )}

        {item.dosen && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="truncate text-slate-600 dark:text-slate-300">Dosen: {item.dosen}</span>
          </div>
        )}

        {item.catatan && (
          <div className="sm:col-span-2 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
            <strong>Catatan:</strong> {item.catatan}
          </div>
        )}
      </div>
    </div>
  );
}
