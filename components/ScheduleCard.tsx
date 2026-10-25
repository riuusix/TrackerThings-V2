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
      className={`group relative rounded-2xl p-4 sm:p-5 bg-surface-elevated border transition-all duration-200 ${
        isPengganti
          ? "border-amber-300/80 dark:border-amber-700/60 bg-amber-50/15 dark:bg-amber-950/10 shadow-2xs hover:border-amber-400"
          : "border-line shadow-2xs hover:border-line-strong hover:shadow-xs"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Left Time Rail: Monospace Tabular Digits */}
        <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0.5 sm:w-28 shrink-0 sm:pr-3 sm:border-r border-line/60">
          <div className="flex items-center gap-1.5 sm:gap-1 text-content-primary font-bold text-sm sm:text-base tracking-tight">
            <Clock className="w-3.5 h-3.5 text-accent sm:hidden" />
            <span>{item.waktuMulai}</span>
            <span className="text-content-muted font-normal text-xs">—</span>
            <span className="text-content-secondary font-medium text-xs sm:text-sm">{item.waktuSelesai}</span>
          </div>
          <span className="text-[10px] text-content-muted hidden sm:inline uppercase tracking-wider font-medium">
            Waktu Kuliah
          </span>
        </div>

        {/* Center: Course Title & Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {isPengganti ? (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Kelas Pengganti
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-accent-muted text-accent border border-line-subtle">
                Reguler
              </span>
            )}

            {item.kategori && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-surface text-content-secondary border border-line-subtle">
                {item.kategori}
              </span>
            )}
          </div>

          <h4 className="text-base sm:text-lg font-bold text-content-primary tracking-tight group-hover:text-accent transition-colors leading-snug">
            {item.namaMatkul}
          </h4>

          {/* Secondary Metadata Row (Room & Lecturer) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-content-secondary">
            {item.lokasi && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-content-muted shrink-0" />
                <span className="font-medium text-content-primary">{item.lokasi}</span>
              </div>
            )}

            {item.lokasi && item.dosen && (
              <span className="text-content-muted">•</span>
            )}

            {item.dosen && (
              <div className="flex items-center gap-1.5 truncate">
                <UserCheck className="w-3.5 h-3.5 text-content-muted shrink-0" />
                <span className="truncate">{item.dosen}</span>
              </div>
            )}
          </div>

          {/* Notes for Replacement Classes */}
          {item.catatan && (
            <div className="mt-2 p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
              <strong>Catatan:</strong> {item.catatan}
            </div>
          )}
        </div>

        {/* Right Action: Replacement Completion */}
        {isPengganti && (
          <div className="self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleSelesai}
              disabled={isPending}
              aria-busy={isPending}
              title="Tandai Kelas Selesai"
              className="inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 transition-all font-semibold active:scale-95 disabled:opacity-50 shadow-2xs"
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
          </div>
        )}
      </div>
    </div>
  );
}
