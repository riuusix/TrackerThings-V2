import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 shadow-sm">
        <FileQuestion className="w-8 h-8" />
      </div>

      <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
        404 - Halaman Tidak Ditemukan
      </h1>

      <p className="text-slate-600 dark:text-slate-400 max-w-md mb-8 text-sm sm:text-base">
        Maaf, tautan atau halaman yang Anda cari tidak tersedia atau telah dipindahkan.
      </p>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-all shadow-md shadow-blue-500/20 active:scale-95"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

