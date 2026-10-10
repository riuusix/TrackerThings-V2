"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { JadwalGabunganItem } from "@/types";
import { ScheduleCard } from "./ScheduleCard";
import { CalendarDays, BookOpen } from "lucide-react";

interface ScheduleListProps {
  schedulesByDay: Record<string, JadwalGabunganItem[]>;
  initialDay: string;
}

const DAYS_OF_WEEK = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export function ScheduleList({
  schedulesByDay,
  initialDay,
}: ScheduleListProps) {
  const [selectedDay, setSelectedDay] = useState<string>(initialDay);

  const currentSchedule = schedulesByDay[selectedDay] || [];

  return (
    <div className="space-y-5">
      {/* 1. TAB NAVIGASI HARI (SENIN-MINGGU) - Universal Blue with layoutId="activeTab" */}
      <div className="relative rounded-2xl p-1.5 sm:p-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day) => {
            const isActive = selectedDay === day;
            const count = schedulesByDay[day]?.length || 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative z-10 flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                {/* Framer-motion blue pill indicator for activeTab */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-600/25 z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}

                <span className="relative z-10">{day}</span>
                <span
                  className={`relative z-10 text-[10px] mt-0.5 px-1.5 rounded-full font-bold transition-colors ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. DAY HEADER TITLE */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Jadwal Kuliah Hari {selectedDay}
            </h3>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold shadow-xs">
          {currentSchedule.length} Kelas Terdaftar
        </span>
      </div>

      {/* 3. SCHEDULE LIST */}
      <div className="space-y-3.5">
        {currentSchedule.length === 0 ? (
          <div className="rounded-2xl p-8 sm:p-10 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto mb-3 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              Tidak Ada Jadwal Kuliah
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Hari {selectedDay} bebas sesi perkuliahan. Manfaatkan waktu untuk belajar mandiri, istirahat, atau menyelesaikan tugas akademik!
            </p>
          </div>
        ) : (
          currentSchedule.map((item) => (
            <ScheduleCard key={`${item.tipe}-${item.id}`} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
