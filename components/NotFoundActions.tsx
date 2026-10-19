"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, BookOpen, GraduationCap, Settings } from "lucide-react";

export function NotFoundActions() {
  const router = useRouter();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-8">
      {/* Primary Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-canvas"
        >
          <Home className="w-4 h-4" />
          <span>Kembali ke Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={handleGoBack}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface hover:bg-surface-hover text-content-primary border border-line font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-canvas"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Halaman Sebelumnya</span>
        </button>
      </div>

      {/* Helpful Quick Navigation Links */}
      <div className="pt-6 border-t border-line">
        <p className="text-xs uppercase tracking-wider text-content-muted font-semibold text-center mb-3">
          Atau kunjungi menu utama berikut
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Link
            href="/matakuliah"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/60 hover:bg-surface border border-line/70 hover:border-line text-content-secondary hover:text-content-primary transition-colors text-xs font-medium group"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div className="truncate text-left">
              <div className="font-semibold text-content-primary">Mata Kuliah</div>
              <div className="text-[11px] text-content-muted truncate">Jadwal semester aktif</div>
            </div>
          </Link>

          <Link
            href="/ujian"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/60 hover:bg-surface border border-line/70 hover:border-line text-content-secondary hover:text-content-primary transition-colors text-xs font-medium group"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
            <div className="truncate text-left">
              <div className="font-semibold text-content-primary">Jadwal Ujian</div>
              <div className="text-[11px] text-content-muted truncate">UTS, UAS, & susulan</div>
            </div>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-surface/60 hover:bg-surface border border-line/70 hover:border-line text-content-secondary hover:text-content-primary transition-colors text-xs font-medium group"
          >
            <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Settings className="w-3.5 h-3.5" />
            </div>
            <div className="truncate text-left">
              <div className="font-semibold text-content-primary">Pengaturan</div>
              <div className="text-[11px] text-content-muted truncate">Preferensi & profil</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
