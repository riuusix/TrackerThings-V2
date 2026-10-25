"use client";

import { useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { GraduationCap, Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fromParam = searchParams.get("from");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (fromParam) {
      formData.set("from", fromParam);
    }

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res.success) {
        // Full browser navigation avoids concurrent router.push() and router.refresh() race condition
        // and guarantees auth_session cookie is attached cleanly across all RSC layouts.
        const targetUrl = res.redirectUrl || (res.role === "admin" ? "/admin" : "/dashboard");
        window.location.assign(targetUrl);
      } else {
        setError(res.error || "Gagal masuk, periksa kembali username dan sandi.");
      }
    });
  };

  return (
    <div className="bg-surface-elevated border border-line rounded-2xl p-6 sm:p-8 shadow-2xs">
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
            Username
          </label>
          <div className="relative">
            <User className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
            <input
              type="text"
              name="username"
              required
              placeholder="Masukkan username"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary">
              Kata Sandi
            </label>
            <Link
              href="/recovery"
              className="text-xs text-accent hover:underline font-medium"
            >
              Lupa Sandi?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full py-3.5 px-4 min-h-[50px] rounded-xl font-semibold text-accent-text bg-accent hover:bg-accent-hover active:scale-95 shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

      <div className="mt-6 pt-6 border-t border-line text-center">
        <p className="text-sm text-content-secondary">
          Belum memiliki akun?{" "}
          <Link
            href="/register"
            className="font-semibold text-accent hover:underline"
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
    <div className="min-h-screen bg-canvas text-content-primary flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl overflow-hidden shadow-xs mb-3 transition-transform hover:scale-105 bg-accent flex items-center justify-center">
            <img
              src="/icon.png"
              alt="TrackerThings Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Tracker<span className="text-accent">Things</span>
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Masuk ke portal manajemen jadwal & tugas akademik Anda
          </p>
        </div>

        <Suspense
          fallback={
            <div className="bg-surface-elevated border border-line rounded-3xl p-8 text-center text-content-muted shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
