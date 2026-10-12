"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { GraduationCap, Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sanitizeRedirectPath } from "@/lib/utils";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const safeRedirectPath = sanitizeRedirectPath(searchParams.get("from"));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res.success) {
        // Full browser navigation avoids concurrent router.push() and router.refresh() race condition
        // and guarantees auth_session cookie is attached cleanly across all RSC layouts.
        window.location.assign(safeRedirectPath);
      } else {
        setError(res.error || "Gagal masuk, periksa kembali username dan sandi.");
      }
    });
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 backdrop-blur-2xl">
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Username
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              name="username"
              required
              placeholder="Masukkan username"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Kata Sandi
            </label>
            <Link
              href="/recovery"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Lupa Sandi?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-white text-sm transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full py-3.5 px-4 min-h-[50px] rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Akun</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-800 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Belum memiliki akun?{" "}
          <Link
            href="/register"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Daftar sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-blue-600/25 mb-3 transition-transform hover:scale-105 bg-blue-700 flex items-center justify-center">
            <img
              src="/icon.png"
              alt="TrackerThings Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Tracker
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text">
              Things
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Masuk ke portal manajemen jadwal & tugas akademik Anda
          </p>
        </div>

        <Suspense
          fallback={
            <div className="glass-card rounded-3xl p-8 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
