"use client";

import { useTransition } from "react";
import { Clock, MapPin, UserCheck, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { JadwalGabunganItem } from "@/types";
import { selesaiKelasPenggantiAction } from "@/app/actions/kelasPengganti";
import { useToast } from "./ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface ScheduleCardProps {
  item: JadwalGabunganItem;
}

export function ScheduleCard({ item }: ScheduleCardProps) {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError } = useToast();

  const handleSelesai = () => {
    if (isPending) return;
    if (!confirm("Selesaikan kelas pengganti ini dan pindahkan ke riwayat?")) return;
    startTransition(async () => {
      try {
        const res = await selesaiKelasPenggantiAction(item.id);
        if (res.success) {
          showSuccess("Kelas pengganti berhasil ditandai selesai.");
        } else {
          showError(classifyApiError(res.error, "Gagal menyelesaikan kelas pengganti."));
        }
      } catch (err) {
        showError(classifyApiError(err, "Gagal memproses penyelesaian kelas pengganti."));
      }
    });
  };

  const isPengganti = item.tipe === "pengganti";

  return (
    <div
      className={`group relative rounded-2xl p-5 sm:p-6 bg-surface-elevated border border-line shadow-xs transition-all duration-200 hover:border-line-strong ${
        isPengganti
          ? "border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10"
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
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle">
                Reguler
              </span>
            )}

            {item.kategori && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-surface text-content-secondary border border-line-subtle">
                {item.kategori}
              </span>
            )}
          </div>

          <h4 className="text-base sm:text-lg font-bold text-content-primary tracking-tight group-hover:text-accent transition-colors">
            {item.namaMatkul}
          </h4>
        </div>

        {isPengganti && (
          <button
            type="button"
            onClick={handleSelesai}
            disabled={isPending}
            aria-busy={isPending}
            title="Tandai Kelas Selesai"
            className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 min-w-[96px] rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 transition-all font-semibold active:scale-95 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Selesai</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Course Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-content-secondary mt-3 pt-3 border-t border-line">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-content-primary">
            {item.waktuMulai} - {item.waktuSelesai}
          </span>
        </div>

        {item.lokasi && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-content-muted shrink-0" />
            <span className="truncate text-content-secondary">{item.lokasi}</span>
          </div>
        )}

        {item.dosen && (
          <div className="flex items-center gap-2 sm:col-span-2">
            <UserCheck className="w-4 h-4 text-content-muted shrink-0" />
            <span className="truncate text-content-secondary">Dosen: {item.dosen}</span>
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
