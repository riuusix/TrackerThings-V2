"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRecoveryPromptAction, recoverAccountAction } from "@/app/actions/auth";
import {
  GraduationCap,
  Lock,
  User,
  ShieldQuestion,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function RecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCheckUsername = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    const u = (formData.get("username") as string)?.trim();
    if (!u) return;

    startTransition(async () => {
      const res = await getRecoveryPromptAction(u);
      if (res.success && res.prompt) {
        setUsername(u);
        setPrompt(res.prompt);
        setStep(2);
      } else {
        setError(res.error || "Akun tidak ditemukan atau pertanyaan keamanan belum diset.");
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("username", username);

    startTransition(async () => {
      const res = await recoverAccountAction(formData);
      if (res.success) {
        setSuccess("Kata sandi berhasil direset! Mengarahkan ke login...");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        setError(res.error || "Gagal mereset kata sandi.");
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 items-center justify-center text-white shadow-xl shadow-indigo-500/25 mb-3">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Pemulihan Akun
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Reset kata sandi melalui verifikasi pertanyaan keamanan
          </p>
        </div>

        <div className="glass-card rounded-3xl p-6 sm:p-8 backdrop-blur-2xl">
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

          {step === 1 ? (
            <form onSubmit={handleCheckUsername} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Masukkan Username Akun
                </label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    name="username"
                    required
                    placeholder="Contoh: budysetiawan"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="w-full py-3.5 px-4 min-h-[50px] rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memeriksa...</span>
                  </>
                ) : (
                  <>
                    <span>Cari Akun</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Pertanyaan Keamanan:
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                  &ldquo;{prompt}&rdquo;
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Jawaban Anda
                </label>
                <input
                  type="text"
                  name="security_answer"
                  required
                  placeholder="Jawaban pertanyaan keamanan"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    name="new_password"
                    required
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="w-full py-3.5 px-4 min-h-[50px] rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Kata Sandi Baru</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-center mt-2"
              >
                Kembali ke pencarian username
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-slate-800 text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
