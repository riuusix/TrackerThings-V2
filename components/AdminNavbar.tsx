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
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/app/actions/auth";

interface AdminNavbarProps {
  currentUsername: string;
  currentUserEmail?: string;
}

export function AdminNavbar({
  currentUsername,
  currentUserEmail,
}: AdminNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

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
    <nav className="sticky top-0 z-40 w-full bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-purple-900/30 dark:border-purple-900/40 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Admin Console Brand */}
          <div className="flex items-center gap-7">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 font-extrabold text-lg sm:text-xl tracking-tight group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30 transition-transform group-hover:scale-105">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-white leading-tight font-black flex items-center gap-1.5">
                  TrackerThings
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                    ADMIN
                  </span>
                </span>
                <span className="text-[10px] text-purple-300/80 font-medium tracking-wide">
                  Centralized Administration Console
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-purple-600/30 text-purple-200 border border-purple-500/30 shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-purple-400" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Action: User Portal Link & Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Switch Button to User App */}
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition-colors"
              title="Kembali ke Dashboard Pengguna"
            >
              <span>Portal Mahasiswa</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <ThemeToggle />

            {/* Admin Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-purple-500/20 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {adminInitial}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight">
                    {currentUsername}
                  </span>
                  <span className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">
                    ADMINISTRATOR
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl p-2 bg-slate-900 border border-purple-500/30 shadow-2xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-800 mb-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-purple-400 uppercase font-bold tracking-wider">
                        Sesi Administrator
                      </p>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-purple-600 text-white uppercase tracking-wider">
                        FULL ACCESS
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate">
                      {currentUsername}
                    </p>
                    {currentUserEmail && (
                      <p className="text-xs text-slate-400 truncate">
                        {currentUserEmail}
                      </p>
                    )}
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-purple-400" />
                      <span>Buka Dashboard Pengguna</span>
                    </span>
                  </Link>

                  <div className="border-t border-slate-800 mt-1 pt-1">
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar (Logout)</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-800 space-y-1">
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-800">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-xl"
              >
                <span className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-purple-400" />
                  <span>Buka Dashboard Pengguna</span>
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

