import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotFoundActions } from "@/components/NotFoundActions";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-content-primary flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-accent/20">
      {/* Top Header Region: Brand Logo & Theme Switcher */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight group focus:outline-none focus:ring-2 focus:ring-accent rounded-xl p-1"
          aria-label="TrackerThings Home"
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs transition-transform group-hover:scale-105 bg-accent flex items-center justify-center shrink-0">
            <img
              src="/icon.png"
              alt="TrackerThings Logo"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-content-primary">
            Tracker<span className="text-accent font-extrabold">Things</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Editorial Hero Section */}
      <main className="max-w-2xl w-full mx-auto my-auto py-12 px-4 sm:px-6 text-center">
        {/* Visual Identity Status Indicator */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-muted/80 border border-line text-accent text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span>Status 404 • Halaman Tidak Ditemukan</span>
        </div>

        {/* Editorial Headline */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-content-primary mb-4 leading-tight">
          Halaman yang Anda tuju belum tersedia.
        </h1>

        {/* Calm Context Description */}
        <p className="text-content-secondary text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-10">
          Tautan mungkin rusak, alamat URL yang dimasukkan kurang tepat, atau halaman telah dipindahkan.
          Seluruh data jadwal kuliah, tugas, dan ujian Anda tetap aman tersimpan di sistem.
        </p>

        {/* Interactive Navigation Actions */}
        <NotFoundActions />
      </main>

      {/* Subtle Footer Region */}
      <footer className="max-w-6xl w-full mx-auto py-4 text-center text-xs text-content-muted border-t border-line/60">
        <p>TrackerThings V2 • Portal Manajemen Jadwal Kuliah & Tugas Akademik</p>
      </footer>
    </div>
  );
}
