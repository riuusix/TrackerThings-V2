"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Calendar,
  BookOpen,
  GraduationCap,
  History,
  Bell,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronDown,
  Clock,
  CheckCircle2,
  Sun,
  Moon,
  Check,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { logoutAction } from "@/app/actions/auth";
import { NotificationItem } from "@/types";

interface NavbarProps {
  username: string;
  userEmail?: string;
  role?: string;
  profilePictureUrl?: string | null;
  notifications?: NotificationItem[];
}

export function Navbar({
  username,
  userEmail,
  role = "user",
  profilePictureUrl,
  notifications = [],
}: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAvatarImgError(false);
  }, [profilePictureUrl]);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const isAdmin = role.toLowerCase() === "admin";
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Calendar },
    { href: "/matakuliah", label: "Mata Kuliah", icon: BookOpen },
    { href: "/ujian", label: "Jadwal Ujian", icon: GraduationCap },
    { href: "/history", label: "Riwayat Kelas", icon: History },
  ];

  const userInitial = (username && username.trim().length > 0)
    ? username.trim().charAt(0).toUpperCase()
    : "U";

  return (
    <nav className="sticky top-0 z-40 w-full bg-canvas/95 backdrop-blur-md border-b border-line transition-colors duration-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo & Brand (Left Region) */}
          <div className="flex items-center shrink-0 z-10">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 font-extrabold text-xl sm:text-2xl tracking-tight group"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs transition-transform group-hover:scale-105 bg-accent flex items-center justify-center">
                <img
                  src="/icon.png"
                  alt="TrackerThings Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-content-primary">
                Tracker<span className="text-accent font-extrabold">Things</span>
              </span>
            </Link>
          </div>

          {/* Mathematically Centered Desktop Navigation Links (Center Region) */}
          <div className="hidden lg:flex items-center space-x-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "text-accent font-bold bg-accent-muted border border-line-subtle shadow-xs"
                      : "text-content-secondary hover:text-content-primary hover:bg-surface"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-content-secondary"}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Header Items: Notifications & Profile Controls (Right Region) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 z-10">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-2.5 rounded-xl bg-surface-elevated hover:bg-surface text-content-primary border border-line transition-all shadow-xs"
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[10px] font-bold text-accent-text items-center justify-center">
                      {notifications.length}
                    </span>
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl p-4 bg-surface-elevated border border-line shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <div className="flex items-center gap-2 font-bold text-content-primary text-sm">
                      <Bell className="w-4 h-4 text-accent" />
                      <span>Notifikasi Penting</span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-accent-muted text-accent font-semibold border border-line-subtle">
                      {notifications.length} Jadwal
                    </span>
                  </div>

                  <div className="divide-y divide-line max-h-72 overflow-y-auto mt-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-content-muted">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                        <p className="text-sm font-semibold text-content-primary">Semua Terkendali!</p>
                        <p className="text-xs text-content-secondary">Tidak ada tugas atau evaluasi terdekat.</p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 flex items-start gap-3 hover:bg-surface p-2 rounded-xl transition-colors"
                        >
                          <div
                            className={`p-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                              item.tipe === "Tugas"
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40"
                            }`}
                          >
                            {item.tipe}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">
                              {item.judul}
                            </p>
                            <p className="text-xs text-content-secondary truncate">
                              {item.namaMatkul}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-content-muted mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{item.waktu}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-surface-elevated hover:bg-surface text-content-primary border border-line transition-all shadow-xs"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
              >
                {/* User Avatar with Image or Initial Fallback */}
                <div className="w-8 h-8 rounded-lg bg-accent text-accent-text flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden shrink-0">
                  {profilePictureUrl && !avatarImgError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePictureUrl}
                      alt={username}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarImgError(true)}
                    />
                  ) : (
                    userInitial
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-content-primary leading-tight">
                    {username}
                  </span>
                  <span className="text-[10px] text-content-secondary font-medium capitalize">
                    {isAdmin ? "Administrator" : "Mahasiswa"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-content-muted hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl p-2 bg-surface-elevated border border-line shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-line mb-1 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-accent text-accent-text flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden shrink-0">
                      {profilePictureUrl && !avatarImgError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profilePictureUrl}
                          alt={username}
                          className="w-full h-full object-cover"
                          onError={() => setAvatarImgError(true)}
                        />
                      ) : (
                        userInitial
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-accent uppercase font-bold tracking-wider mb-0.5">
                        {isAdmin ? "Sesi Administrator" : "Profil Akun"}
                      </p>
                      <p className="text-sm font-bold text-content-primary truncate">
                        {username}
                      </p>
                      {userEmail && (
                        <p className="text-xs text-content-secondary truncate">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Panel Admin Access (Strictly Guarded for Verified Administrator Role) */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-accent hover:bg-accent-muted transition-colors border border-line-subtle/70 mb-1"
                    >
                      <span className="flex items-center gap-2.5">
                        <Shield className="w-4 h-4 text-accent" />
                        <span>Panel Admin</span>
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-accent text-accent-text tracking-wider">
                        ADMIN
                      </span>
                    </Link>
                  )}

                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors"
                  >
                    <User className="w-4 h-4 text-accent" />
                    <span>Profil Pengguna</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors"
                  >
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span>Keamanan & Sandi</span>
                  </Link>

                  {/* Theme Switcher in Dropdown */}
                  <div className="px-3 py-2 border-t border-line mt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">
                        Tampilan
                      </span>
                      <span className="text-[10px] text-content-muted capitalize">
                        {mounted ? (isDark ? "Gelap" : "Terang") : "..."}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface border border-line-subtle">
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          mounted && !isDark
                            ? "bg-surface-elevated text-accent shadow-xs border border-line"
                            : "text-content-secondary hover:text-content-primary"
                        }`}
                        aria-label="Pilih Tema Terang"
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Terang</span>
                        {mounted && !isDark && <Check className="w-3 h-3 text-accent ml-auto" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                          mounted && isDark
                            ? "bg-surface-elevated text-accent shadow-xs border border-line"
                            : "text-content-secondary hover:text-content-primary"
                        }`}
                        aria-label="Pilih Tema Gelap"
                      >
                        <Moon className="w-3.5 h-3.5 text-accent" />
                        <span>Gelap</span>
                        {mounted && isDark && <Check className="w-3 h-3 text-accent ml-auto" />}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-line mt-1 pt-1">
                    <form
                      action={async () => {
                        setIsLoggingOut(true);
                        await logoutAction();
                      }}
                    >
                      <button
                        type="submit"
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isLoggingOut ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            <span>Keluar...</span>
                          </>
                        ) : (
                          <>
                            <LogOut className="w-4 h-4" />
                            <span>Keluar (Logout)</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-surface-elevated text-content-primary border border-line"
                aria-label="Menu Navigasi"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-line space-y-2 animate-in fade-in-50 duration-150">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-accent-muted text-accent border border-line-subtle shadow-xs"
                        : "text-content-secondary hover:text-content-primary hover:bg-surface"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Theme Toggle Section */}
            <div className="pt-2 border-t border-line px-2">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs font-semibold text-content-secondary">Mode Tampilan</span>
                <span className="text-xs text-content-muted capitalize">
                  {mounted ? (isDark ? "Gelap" : "Terang") : "..."}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface border border-line-subtle">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    mounted && !isDark
                      ? "bg-surface-elevated text-accent shadow-xs border border-line"
                      : "text-content-secondary hover:text-content-primary"
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Terang</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    mounted && isDark
                      ? "bg-surface-elevated text-accent shadow-xs border border-line"
                      : "text-content-secondary hover:text-content-primary"
                  }`}
                >
                  <Moon className="w-4 h-4 text-accent" />
                  <span>Gelap</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
