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
    <div className="space-y-4">
      {/* 1. Day Selector Tabs (Senin - Minggu) */}
      <div className="rounded-2xl p-1.5 bg-surface border border-line shadow-2xs">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {DAYS_OF_WEEK.map((day) => {
            const isActive = selectedDay === day;
            const count = schedulesByDay[day]?.length || 0;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative z-10 flex flex-col items-center py-2 px-1 rounded-xl text-xs font-semibold transition-colors duration-150 ${
                  isActive
                    ? "text-accent-text"
                    : "text-content-secondary hover:text-content-primary hover:bg-surface-hover"
                }`}
              >
                {/* Active Indicator with Spring Animation */}
                {isActive && (
                  <motion.div
                    layoutId="activeDayTab"
                    className="absolute inset-0 bg-accent rounded-xl shadow-xs z-0"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  />
                )}

                <span className="relative z-10">{day}</span>
                <span
                  className={`relative z-10 text-[10px] mt-0.5 px-1.5 rounded-full font-bold transition-colors ${
                    isActive
                      ? "bg-accent-text/25 text-accent-text"
                      : "bg-surface-elevated text-content-secondary border border-line-subtle"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Section Header Title */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent-muted border border-line-subtle flex items-center justify-center text-accent shadow-2xs">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">
              Jadwal Kuliah: {selectedDay}
            </h3>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-surface-elevated border border-line text-content-secondary font-semibold shadow-2xs">
          {currentSchedule.length} Sesi
        </span>
      </div>

      {/* 3. Schedule Items List */}
      <div className="space-y-3">
        {currentSchedule.length === 0 ? (
          <div className="rounded-2xl p-7 sm:p-9 text-center bg-surface-elevated border border-line shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-accent-muted border border-line-subtle flex items-center justify-center text-accent mx-auto mb-2.5 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-content-primary text-sm sm:text-base">
              Tidak Ada Jadwal Kuliah
            </h4>
            <p className="text-xs text-content-secondary mt-1 max-w-sm mx-auto">
              Hari {selectedDay} bebas sesi perkuliahan tatap muka. Anda dapat fokus mengerjakan tugas atau belajar mandiri.
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
