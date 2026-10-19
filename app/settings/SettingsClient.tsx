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
  Shield,
  KeyRound,
  ShieldQuestion,
  History,
  Lock,
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
    <div className="min-h-screen bg-canvas text-content-primary pb-16">
      <Navbar
        username={user.username}
        userEmail={user.email}
        profilePictureUrl={user.profilePictureUrl}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <div className="pb-2 border-b border-line">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60">
              Pengaturan Akun
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-content-primary tracking-tight">
            Keamanan & Kata Sandi
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Ubah kata sandi akun dan atur pertanyaan pemulihan keamanan jika lupa kata sandi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Change Password Card */}
          <div className="bg-surface-elevated border border-line rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-line">
                <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-content-primary text-base">
                    Ganti Kata Sandi
                  </h3>
                  <p className="text-xs text-content-muted">Gunakan kombinasi yang kuat dan unik</p>
                </div>
              </div>

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

              <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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

                <div>
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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

                <button
                  type="submit"
                  disabled={pwdPending}
                  aria-busy={pwdPending}
                  className="w-full py-2.5 px-4 min-h-[42px] rounded-xl font-semibold text-accent-text bg-accent hover:bg-accent-hover shadow-xs transition-all duration-200 active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
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
              </form>
            </div>
          </div>

          {/* Security Question Card */}
          <div className="bg-surface-elevated border border-line rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-line">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldQuestion className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-content-primary text-base">
                    Pertanyaan Keamanan
                  </h3>
                  <p className="text-xs text-content-muted">Untuk pemulihan jika lupa kata sandi</p>
                </div>
              </div>

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

              <form onSubmit={handleSecuritySubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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

                <div>
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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
                  <label className="block text-xs font-semibold text-content-secondary mb-1">
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

                <button
                  type="submit"
                  disabled={secPending}
                  aria-busy={secPending}
                  className="w-full py-2.5 px-4 min-h-[42px] rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all duration-200 active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
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
              </form>
            </div>
          </div>
        </div>

        {/* Audit Log Card */}
        <div className="bg-surface-elevated border border-line rounded-3xl p-6 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-line">
            <History className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-content-primary text-base">
              Catatan Aktivitas Akun
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-surface border border-line">
              <span className="text-content-muted block mb-1">Akun Dibuat</span>
              <strong className="text-content-primary">
                {formatIndonesianDateTime(user.createdAt)}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line">
              <span className="text-content-muted block mb-1">Profil Terakhir Diperbarui</span>
              <strong className="text-content-primary">
                {user.profileUpdatedAt
                  ? formatIndonesianDateTime(user.profileUpdatedAt)
                  : "Belum pernah"}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line">
              <span className="text-content-muted block mb-1">Sandi Terakhir Diubah</span>
              <strong className="text-content-primary">
                {user.passwordChangedAt
                  ? formatIndonesianDateTime(user.passwordChangedAt)
                  : "Belum pernah"}
              </strong>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
