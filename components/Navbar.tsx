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
  Users,
  Megaphone,
  FileText,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { logoutAction } from "@/app/actions/auth";
import { NotificationItem } from "@/types";

interface NavbarProps {
  username: string;
  userEmail?: string;
  role?: string;
  notifications?: NotificationItem[];
}

export function Navbar({
  username,
  userEmail,
  role = "user",
  notifications = [],
}: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const isAdmin = role.toLowerCase() === "admin";

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
    <nav className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-7">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 font-extrabold text-xl sm:text-2xl tracking-tight group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/25 transition-transform group-hover:scale-105">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-slate-900 dark:text-white">
                Tracker
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-transparent bg-clip-text">
                  Things
                </span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Header Items: Notifications, Theme Toggle, Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all"
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 text-[10px] font-bold text-white items-center justify-center">
                      {notifications.length}
                    </span>
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-sm">
                      <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Notifikasi Penting</span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800/40">
                      {notifications.length} Jadwal
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto mt-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 dark:text-slate-500">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Semua Terkendali!</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">Tidak ada tugas atau evaluasi terdekat.</p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-2 rounded-xl transition-colors"
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
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {item.judul}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {item.namaMatkul}
                            </p>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
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

            {/* Dark Mode Sun/Moon Toggle */}
            <ThemeToggle />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition-all"
              >
                {/* User Avatar with Initials */}
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  {userInitial}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    {username}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium capitalize">
                    {isAdmin ? "Administrator" : "Mahasiswa"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">
                        Profil Akun
                      </p>
                      {isAdmin && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {username}
                    </p>
                    {userEmail && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {userEmail}
                      </p>
                    )}
                  </div>

                  {/* ADMIN SPECIFIC MENU ITEMS (Clean link to dedicated admin pages) */}
                  {isAdmin && (
                    <div className="py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                      <p className="px-3 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Panel Administrator
                      </p>
                      <Link
                        href="/admin/users"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Manajemen User</span>
                      </Link>

                      <Link
                        href="/admin/announcements"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Kelola Pengumuman</span>
                      </Link>

                      <Link
                        href="/admin/announcements#logs"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>Admin Logs</span>
                      </Link>
                    </div>
                  )}

                  <Link
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Profil Pengguna</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <span>Keamanan & Sandi</span>
                  </Link>

                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"
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
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <span className="block px-4 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Panel Admin
                </span>
                <Link
                  href="/admin/users"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Manajemen User</span>
                </Link>
                <Link
                  href="/admin/announcements"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Kelola Pengumuman</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
