"use client";

import { useState, useTransition } from "react";
import { Navbar } from "@/components/Navbar";
import { UserProfile } from "@/types";
import {
  updatePasswordAction,
  updateSecurityPromptAction,
} from "@/app/actions/auth";
import { formatIndonesianDateTime } from "@/lib/utils";
import {
  KeyRound,
  ShieldQuestion,
  History,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { classifyApiError } from "@/lib/feedback";

interface SettingsClientProps {
  user: UserProfile;
}

export function SettingsClient({ user }: SettingsClientProps) {
  const [pwdPending, startPwdTransition] = useTransition();
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const [secPending, startSecTransition] = useTransition();
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwdPending) return;
    setPwdError(null);
    setPwdSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startPwdTransition(async () => {
      try {
        const res = await updatePasswordAction(formData);
        if (res.success) {
          setPwdSuccess("Kata sandi berhasil diperbarui!");
          showSuccess("Kata sandi berhasil diperbarui!");
          form.reset();
        } else {
          const friendly = classifyApiError(res.error, "Gagal mengubah kata sandi.");
          setPwdError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal mengubah kata sandi.");
        setPwdError(friendly);
        showError(friendly);
      }
    });
  };

  const handleSecuritySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (secPending) return;
    setSecError(null);
    setSecSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startSecTransition(async () => {
      try {
        const res = await updateSecurityPromptAction(formData);
        if (res.success) {
          setSecSuccess("Pertanyaan pemulihan berhasil diperbarui!");
          showSuccess("Pertanyaan pemulihan berhasil diperbarui!");
        } else {
          const friendly = classifyApiError(res.error, "Gagal memperbarui pertanyaan pemulihan.");
          setSecError(friendly);
          showError(friendly);
        }
      } catch (err) {
        const friendly = classifyApiError(err, "Gagal memperbarui pertanyaan pemulihan.");
        setSecError(friendly);
        showError(friendly);
      }
    });
  };

  return (
    <div className="min-h-screen bg-canvas text-content-primary pb-20">
      <Navbar
        username={user.username}
        userEmail={user.email}
        role={user.role || "user"}
        profilePictureUrl={user.profilePictureUrl}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 sm:pt-9 space-y-8">
        {/* Editorial Page Header (No Decorative Eyebrow Pill) */}
        <header className="pb-4 border-b border-line">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-content-secondary font-medium">
            <span className="text-accent font-semibold">Pengaturan Akun</span>
            <span className="text-content-muted">·</span>
            <span className="font-mono text-content-muted">@{user.username}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Keamanan & Kata Sandi
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Kelola kredensial kata sandi dan pertanyaan pemulihan untuk menjaga keamanan akses akun Anda.
          </p>
        </header>

        {/* Section 1: Two-Column Editorial Split — Ganti Kata Sandi */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center gap-2 text-accent font-bold text-sm">
              <KeyRound className="w-4 h-4 shrink-0" />
              <h2>Ganti Kata Sandi</h2>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              Gunakan kombinasi minimal 6 karakter yang unik. Memperbarui kata sandi secara berkala membantu melindungi data jadwal dan akademik Anda.
            </p>
          </div>

          <div className="lg:col-span-8 bg-surface-elevated border border-line rounded-2xl p-5 sm:p-6 shadow-2xs">
            {pwdError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{pwdError}</span>
              </div>
            )}

            {pwdSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                  Kata Sandi Saat Ini
                </label>
                <input
                  type="password"
                  name="current_password"
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                    Kata Sandi Baru
                  </label>
                  <input
                    type="password"
                    name="new_password"
                    required
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    required
                    placeholder="Ketik ulang kata sandi baru"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pwdPending}
                  aria-busy={pwdPending}
                  className="py-2.5 px-5 min-h-[40px] rounded-xl font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {pwdPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Perbarui Kata Sandi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        <hr className="border-line" />

        {/* Section 2: Two-Column Editorial Split — Pertanyaan Keamanan */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center gap-2 text-accent font-bold text-sm">
              <ShieldQuestion className="w-4 h-4 shrink-0" />
              <h2>Pertanyaan Keamanan</h2>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              Digunakan sebagai metode verifikasi pemulihan mandiri apabila Anda lupa kata sandi utama. Pastikan jawaban hanya diketahui oleh Anda.
            </p>
          </div>

          <div className="lg:col-span-8 bg-surface-elevated border border-line rounded-2xl p-5 sm:p-6 shadow-2xs">
            {secError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{secError}</span>
              </div>
            )}

            {secSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{secSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSecuritySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                  Pertanyaan Keamanan
                </label>
                <input
                  type="text"
                  name="security_prompt"
                  required
                  defaultValue={user.securityPrompt || ""}
                  placeholder="Contoh: Apa nama hewan peliharaan pertama Anda?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                    Jawaban Rahasia
                  </label>
                  <input
                    type="text"
                    name="security_answer"
                    required
                    placeholder="Jawaban pertanyaan keamanan"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-content-secondary mb-1.5">
                    Konfirmasi Kata Sandi Saat Ini
                  </label>
                  <input
                    type="password"
                    name="current_password"
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-line text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={secPending}
                  aria-busy={secPending}
                  className="py-2.5 px-5 min-h-[40px] rounded-xl font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {secPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Pertanyaan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        <hr className="border-line" />

        {/* Section 3: Catatan Aktivitas Akun (Hairline-Divided Audit Ledger, No Nested Boxes) */}
        <section className="bg-surface-elevated border border-line rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center gap-2">
            <History className="w-4 h-4 text-accent shrink-0" />
            <h3 className="font-bold text-content-primary text-sm sm:text-base tracking-tight">
              Catatan Aktivitas Akun
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line bg-surface/30 text-xs sm:text-sm">
            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted block mb-1">
                Akun Dibuat
              </span>
              <strong className="font-mono tabular-nums text-content-primary font-semibold">
                {formatIndonesianDateTime(user.createdAt)}
              </strong>
            </div>

            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted block mb-1">
                Profil Terakhir Diperbarui
              </span>
              <strong className="font-mono tabular-nums text-content-primary font-semibold">
                {user.profileUpdatedAt
                  ? formatIndonesianDateTime(user.profileUpdatedAt)
                  : "Belum pernah"}
              </strong>
            </div>

            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted block mb-1">
                Sandi Terakhir Diubah
              </span>
              <strong className="font-mono tabular-nums text-content-primary font-semibold">
                {user.passwordChangedAt
                  ? formatIndonesianDateTime(user.passwordChangedAt)
                  : "Belum pernah"}
              </strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
