"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import {
  GraduationCap,
  Lock,
  User,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await registerAction(formData);
      if (res.success) {
        setSuccess(res.message || "Pendaftaran berhasil! Mengarahkan ke login...");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        setError(res.error || "Gagal membuat akun.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary flex flex-col justify-center items-center p-4 py-12 relative">
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
            Buat akun baru untuk mulai mengelola jadwal dan tugas Anda
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-surface-elevated border border-line rounded-2xl p-6 sm:p-8 shadow-2xs">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
                <input
                  type="text"
                  name="full_name"
                  placeholder="Nama Lengkap Anda"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
                <input
                  type="text"
                  name="username"
                  required
                  placeholder="Username unik"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                Email Kampus / Pribadi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="mahasiswa@univ.ac.id"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                Nomor WhatsApp / HP
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
                <input
                  type="tel"
                  name="phone_number"
                  placeholder="081234567890"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                Kata Sandi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-3 text-content-muted" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-surface border border-line focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-content-primary placeholder:text-content-muted text-sm transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="w-full py-3.5 px-4 min-h-[50px] rounded-xl font-semibold text-accent-text bg-accent hover:bg-accent-hover active:scale-95 shadow-xs transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <span>Daftar Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-line text-center">
            <p className="text-sm text-content-secondary">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-semibold text-accent hover:underline"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
