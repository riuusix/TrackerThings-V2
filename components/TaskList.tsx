"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { TugasItem } from "@/types";
import { TaskItem } from "./TaskItem";
import {
  InvisibleTaskDeck,
  INVISIBLE_PAGINATION_PAGE_SIZE,
} from "./InvisibleTaskDeck";
import {
  fetchWithCache,
  setCachedResource,
  setRequestCacheUserScope,
} from "@/lib/requestCache";
import {
  ListTodo,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pin,
  Search,
  SlidersHorizontal,
} from "lucide-react";

interface TaskListProps {
  urgentTasks: TugasItem[];
  completedTasks: TugasItem[];
  onEditTask: (task: TugasItem) => void;
  userScope?: string;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  tinggi: 0,
  sedang: 1,
  rendah: 2,
};

function sortActiveTasksCanonical(tasks: TugasItem[]): TugasItem[] {
  return [...tasks].sort((a, b) => {
    const timeA = new Date(a.deadline).getTime();
    const timeB = new Date(b.deadline).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const wA = PRIORITY_WEIGHT[(a.prioritas || "").toLowerCase()] ?? 1;
    const wB = PRIORITY_WEIGHT[(b.prioritas || "").toLowerCase()] ?? 1;
    if (wA !== wB) return wA - wB;
    return a.id - b.id;
  });
}

export function TaskList({
  urgentTasks: initialUrgentTasks,
  completedTasks: initialCompletedTasks,
  onEditTask,
  userScope,
}: TaskListProps) {
  // Combine and maintain optimistic client-side task state so single-task mutations
  // (pin, progress, delete) update in-place without waiting for full SSR reload.
  const [tasksState, setTasksState] = useState<TugasItem[]>(() => [
    ...initialUrgentTasks,
    ...initialCompletedTasks,
  ]);

  useEffect(() => {
    const merged = [...initialUrgentTasks, ...initialCompletedTasks];
    setTasksState(merged);
    if (userScope) {
      setRequestCacheUserScope(userScope);
    }
    setCachedResource("tugas", "all", merged);
  }, [initialUrgentTasks, initialCompletedTasks, userScope]);

  // History panel & URL-synchronized filter/pagination state
  const [showCompleted, setShowCompleted] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPriority, setHistoryPriority] = useState("Semua");
  const [historySort, setHistorySort] = useState<"deadline_desc" | "deadline_asc">("deadline_desc");
  const [historyPage, setHistoryPage] = useState(0);

  // Hydrate initial Task History filter/page state from URL query parameters
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("historyQ");
    const prio = params.get("historyPriority");
    const sort = params.get("historySort");
    const pageStr = params.get("historyPage");

    if (q) {
      setHistorySearch(q);
      setShowCompleted(true);
    }
    if (prio && ["Semua", "Tinggi", "Sedang", "Rendah"].includes(prio)) {
      setHistoryPriority(prio);
      if (prio !== "Semua") setShowCompleted(true);
    }
    if (sort === "deadline_asc" || sort === "deadline_desc") {
      setHistorySort(sort);
    }
    if (pageStr) {
      const parsed = parseInt(pageStr, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        setHistoryPage(parsed - 1);
        setShowCompleted(true);
      }
    }
  }, []);

  // Synchronize Task History state back to URL query parameters without full reload
  const syncHistoryUrlState = useCallback(
    (nextPage: number, nextQ: string, nextPriority: string, nextSort: string) => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (nextQ.trim()) {
        url.searchParams.set("historyQ", nextQ.trim());
      } else {
        url.searchParams.delete("historyQ");
      }
      if (nextPriority && nextPriority !== "Semua") {
        url.searchParams.set("historyPriority", nextPriority);
      } else {
        url.searchParams.delete("historyPriority");
      }
      if (nextSort && nextSort !== "deadline_desc") {
        url.searchParams.set("historySort", nextSort);
      } else {
        url.searchParams.delete("historySort");
      }
      if (nextPage > 0) {
        url.searchParams.set("historyPage", String(nextPage + 1));
      } else {
        url.searchParams.delete("historyPage");
      }
      window.history.replaceState({}, "", url.toString());
    },
    []
  );

  const handleTaskMutated = useCallback(
    (patch: Partial<TugasItem> & { id: number }) => {
      setTasksState((prev) =>
        prev.map((item) =>
          item.id === patch.id ? { ...item, ...patch } : item
        )
      );
    },
    []
  );

  const handleTaskDeleted = useCallback((id: number) => {
    setTasksState((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Partition active vs completed tasks deterministically
  const activeTasks = useMemo(
    () =>
      sortActiveTasksCanonical(
        tasksState.filter((t) => t.status !== "Selesai" && t.progress < 100)
      ),
    [tasksState]
  );

  // Single-Representation Contract: Pinned vs Unpinned Active Tasks never overlap
  const pinnedTasks = useMemo(
    () => activeTasks.filter((t) => Boolean(t.isPinned ?? t.is_pinned)),
    [activeTasks]
  );

  const unpinnedUrgentTasks = useMemo(() => {
    const pinnedIds = new Set(pinnedTasks.map((t) => t.id));
    return activeTasks.filter((t) => !pinnedIds.has(t.id));
  }, [activeTasks, pinnedTasks]);

  const completedTasksAll = useMemo(
    () =>
      tasksState.filter((t) => t.status === "Selesai" || t.progress >= 100),
    [tasksState]
  );

  const filteredCompletedTasks = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return completedTasksAll
      .filter((t) => {
        if (
          historyPriority !== "Semua" &&
          (t.prioritas || "").toLowerCase() !== historyPriority.toLowerCase()
        ) {
          return false;
        }
        if (q) {
          const matchTitle = t.namaTugas.toLowerCase().includes(q);
          const matchCourse = (t.jadwal?.namaMatkul || "")
            .toLowerCase()
            .includes(q);
          return matchTitle || matchCourse;
        }
        return true;
      })
      .sort((a, b) => {
        const tA = new Date(a.deadline).getTime();
        const tB = new Date(b.deadline).getTime();
        return historySort === "deadline_asc" ? tA - tB : tB - tA;
      });
  }, [completedTasksAll, historySearch, historyPriority, historySort]);

  // Selective next-page prefetching for Task History via user-scoped requestCache
  const handlePrefetchCompletedPage = useCallback(
    (nextPageZeroBased: number) => {
      const apiPage = nextPageZeroBased + 1;
      const queryParams = new URLSearchParams({
        status: "completed",
        page: String(apiPage),
        limit: String(INVISIBLE_PAGINATION_PAGE_SIZE),
        sort: historySort,
      });
      if (historyPriority !== "Semua") {
        queryParams.set("prioritas", historyPriority);
      }
      if (historySearch.trim()) {
        queryParams.set("q", historySearch.trim());
      }
      const queryKey = queryParams.toString();
      void fetchWithCache({
        resource: "tugas",
        queryKey,
        fetcher: async () => {
          const res = await fetch(`/api/tugas?${queryKey}`, {
            method: "GET",
            credentials: "same-origin",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        },
      }).catch(() => {
        // Silent prefetch fallback
      });
    },
    [historySort, historyPriority, historySearch]
  );

  return (
    <div className="space-y-6">
      {/* 1. Pinned Tasks Section (Disematkan — Max 3 per Invisible Deck Page) */}
      {pinnedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 pb-1 border-b border-line/60">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-accent fill-current shrink-0" />
              <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">
                Disematkan
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-accent-muted border border-line-subtle text-accent shadow-2xs">
              {pinnedTasks.length} Semat
            </span>
          </div>

          <InvisibleTaskDeck
            items={pinnedTasks}
            pageSize={INVISIBLE_PAGINATION_PAGE_SIZE}
            getItemKey={(t) => t.id}
            ariaLabel="Daftar Tugas Disematkan"
            renderItem={(task) => (
              <TaskItem
                task={task}
                onEdit={onEditTask}
                onTaskMutated={handleTaskMutated}
                onTaskDeleted={handleTaskDeleted}
              />
            )}
          />
        </div>
      )}

      {/* 2. Active Tasks Section (Tugas Akademik — Max 3 per Invisible Deck Page) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 pb-1 border-b border-line/60">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-accent shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">
              Tugas Akademik
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold px-2.5 py-1 rounded-lg bg-surface-elevated border border-line text-content-secondary shadow-2xs">
            {unpinnedUrgentTasks.length} Aktif
          </span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="rounded-2xl p-7 sm:p-8 text-center bg-surface-elevated border border-line shadow-2xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-2.5 opacity-80" />
            <h4 className="font-bold text-content-primary text-sm sm:text-base">
              Semua Tugas Selesai
            </h4>
            <p className="text-xs text-content-secondary mt-1 max-w-xs mx-auto">
              Tidak ada tugas akademik aktif saat ini. Waktu yang tepat untuk
              istirahat atau mengulang materi.
            </p>
          </div>
        ) : unpinnedUrgentTasks.length === 0 ? (
          <div className="rounded-2xl p-4 bg-surface-elevated border border-line text-xs text-content-secondary flex items-center gap-2.5 shadow-2xs">
            <Pin className="w-4 h-4 text-accent shrink-0" />
            <span>
              Seluruh tugas aktif saat ini berada pada bagian{" "}
              <strong className="text-content-primary">Disematkan</strong> di
              atas.
            </span>
          </div>
        ) : (
          <InvisibleTaskDeck
            items={unpinnedUrgentTasks}
            pageSize={INVISIBLE_PAGINATION_PAGE_SIZE}
            getItemKey={(t) => t.id}
            ariaLabel="Daftar Tugas Akademik Aktif"
            renderItem={(task) => (
              <TaskItem
                task={task}
                onEdit={onEditTask}
                onTaskMutated={handleTaskMutated}
                onTaskDeleted={handleTaskDeleted}
              />
            )}
          />
        )}
      </div>

      {/* 3. Completed Task History (Riwayat Tugas Selesai — Filterable + Max 3 per Invisible Deck Page) */}
      {completedTasksAll.length > 0 && (
        <div className="pt-1 space-y-3">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            aria-expanded={showCompleted}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-surface/60 hover:bg-surface border border-line text-xs font-semibold text-content-secondary hover:text-content-primary transition-all duration-150"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono tabular-nums">
                Riwayat Tugas Selesai ({completedTasksAll.length})
              </span>
            </div>
            {showCompleted ? (
              <ChevronUp className="w-3.5 h-3.5 text-content-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-content-muted" />
            )}
          </button>

          {showCompleted && (
            <div className="space-y-3 animate-in fade-in-50 duration-200">
              {/* Compact Search, Priority Filter & Sort Bar */}
              <div className="p-3 rounded-xl bg-surface-elevated border border-line space-y-2.5 shadow-2xs">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHistorySearch(val);
                      setHistoryPage(0);
                      syncHistoryUrlState(0, val, historyPriority, historySort);
                    }}
                    placeholder="Cari nama tugas atau mata kuliah..."
                    aria-label="Cari riwayat tugas selesai"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-content-primary placeholder:text-content-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Priority Filter Pills */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {(["Semua", "Tinggi", "Sedang", "Rendah"] as const).map(
                      (prio) => {
                        const active = historyPriority === prio;
                        return (
                          <button
                            key={prio}
                            type="button"
                            onClick={() => {
                              setHistoryPriority(prio);
                              setHistoryPage(0);
                              syncHistoryUrlState(
                                0,
                                historySearch,
                                prio,
                                historySort
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                              active
                                ? "bg-accent text-accent-text shadow-2xs"
                                : "bg-surface text-content-secondary hover:text-content-primary border border-line-subtle"
                            }`}
                          >
                            {prio}
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Sort Order Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextSort =
                        historySort === "deadline_desc"
                          ? "deadline_asc"
                          : "deadline_desc";
                      setHistorySort(nextSort);
                      setHistoryPage(0);
                      syncHistoryUrlState(
                        0,
                        historySearch,
                        historyPriority,
                        nextSort
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover border border-line-subtle text-[11px] font-semibold text-content-secondary hover:text-content-primary transition-colors"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-accent" />
                    <span>
                      {historySort === "deadline_desc"
                        ? "Terbaru"
                        : "Terlama"}
                    </span>
                  </button>
                </div>
              </div>

              {filteredCompletedTasks.length === 0 ? (
                <div className="rounded-xl p-5 text-center bg-surface-elevated border border-line text-xs text-content-secondary">
                  Tidak ada riwayat tugas selesai yang cocok dengan filter
                  pencarian.
                </div>
              ) : (
                <InvisibleTaskDeck
                  items={filteredCompletedTasks}
                  pageSize={INVISIBLE_PAGINATION_PAGE_SIZE}
                  currentPage={historyPage}
                  onPageChange={(nextPage) => {
                    setHistoryPage(nextPage);
                    syncHistoryUrlState(
                      nextPage,
                      historySearch,
                      historyPriority,
                      historySort
                    );
                  }}
                  onPrefetchPage={handlePrefetchCompletedPage}
                  getItemKey={(t) => t.id}
                  ariaLabel="Daftar Riwayat Tugas Selesai"
                  renderItem={(task) => (
                    <TaskItem
                      task={task}
                      onEdit={onEditTask}
                      onTaskMutated={handleTaskMutated}
                      onTaskDeleted={handleTaskDeleted}
                    />
                  )}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
