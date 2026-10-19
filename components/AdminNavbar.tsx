"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Shield,
  Users,
  Megaphone,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Sun,
  Moon,
  Check,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { logoutAction } from "@/app/actions/auth";

interface AdminNavbarProps {
  currentUsername: string;
  currentUserEmail?: string;
  profilePictureUrl?: string | null;
}

export function AdminNavbar({
  currentUsername,
  currentUserEmail,
  profilePictureUrl,
}: AdminNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const adminLinks = [
    { href: "/admin", label: "Ringkasan", icon: LayoutDashboard },
    { href: "/admin/users", label: "Manajemen User", icon: Users },
    { href: "/admin/announcements", label: "Kelola Pengumuman", icon: Megaphone },
  ];

  const adminInitial = (currentUsername && currentUsername.trim().length > 0)
    ? currentUsername.trim().charAt(0).toUpperCase()
    : "A";

  return (
    <nav className="sticky top-0 z-40 w-full bg-canvas/95 backdrop-blur-md border-b border-line text-content-primary shadow-2xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo & Admin Console Brand (Left Region) */}
          <div className="flex items-center shrink-0 z-10">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 font-extrabold text-lg sm:text-xl tracking-tight group"
            >
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-text shadow-xs transition-transform group-hover:scale-105">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-content-primary leading-tight font-black flex items-center gap-1.5">
                  TrackerThings
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-accent-muted text-accent border border-line-subtle uppercase tracking-wider">
                    ADMIN
                  </span>
                </span>
                <span className="text-[10px] text-content-secondary font-medium tracking-wide">
                  Console Administrator
                </span>
              </div>
            </Link>
          </div>

          {/* Mathematically Centered Desktop Navigation Links (Center Region) */}
          <div className="hidden lg:flex items-center space-x-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-accent-muted text-accent border border-line-subtle shadow-xs"
                      : "text-content-secondary hover:text-content-primary hover:bg-surface"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-content-secondary"}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right Action: User Portal Link & Profile (Right Region) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 z-10">
            {/* Quick Switch Button to User App */}
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-content-secondary hover:text-content-primary bg-surface hover:bg-surface-elevated border border-line transition-all shadow-xs"
              title="Buka Portal Mahasiswa"
            >
              <span>Portal Mahasiswa</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-content-muted" />
            </Link>

              {/* Admin Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-surface-elevated hover:bg-surface text-content-primary border border-line transition-all shadow-xs"
                  aria-expanded={profileDropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-text font-bold text-sm shadow-xs overflow-hidden shrink-0">
                    {profilePictureUrl && !avatarImgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profilePictureUrl}
                        alt={currentUsername}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarImgError(true)}
                      />
                    ) : (
                      adminInitial
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-content-primary leading-tight">
                      {currentUsername}
                    </span>
                    <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">
                      ADMINISTRATOR
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-content-muted hidden sm:block" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl p-2 bg-surface-elevated border border-line shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="px-3 py-2.5 border-b border-line mb-1 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-text font-bold text-sm shadow-xs overflow-hidden shrink-0">
                        {profilePictureUrl && !avatarImgError ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profilePictureUrl}
                            alt={currentUsername}
                            className="w-full h-full object-cover"
                            onError={() => setAvatarImgError(true)}
                          />
                        ) : (
                          adminInitial
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[10px] text-accent uppercase font-bold tracking-wider">
                            Sesi Administrator
                          </p>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-accent-muted text-accent border border-line-subtle uppercase tracking-wider">
                            FULL ACCESS
                          </span>
                        </div>
                        <p className="text-sm font-bold text-content-primary truncate">
                          {currentUsername}
                        </p>
                        {currentUserEmail && (
                          <p className="text-xs text-content-secondary truncate">
                            {currentUserEmail}
                          </p>
                        )}
                      </div>
                    </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-content-secondary hover:text-content-primary hover:bg-surface transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-accent" />
                      <span>Buka Portal Mahasiswa</span>
                    </span>
                  </Link>

                  {/* Theme Switcher in Admin Dropdown */}
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
                aria-label="Menu Admin"
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
              {adminLinks.map((link) => {
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

              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-content-secondary hover:text-content-primary hover:bg-surface rounded-xl"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-accent" />
                  <span>Buka Portal Mahasiswa</span>
                </span>
              </Link>
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

