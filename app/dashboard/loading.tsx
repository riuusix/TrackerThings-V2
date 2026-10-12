import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-10 w-3/5 sm:w-2/5" />
        <Skeleton className="h-4 w-4/5 sm:w-1/2" />
      </div>

      {/* Days Selector Skeleton */}
      <div className="flex gap-2 overflow-x-hidden py-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-20 shrink-0" rounded="rounded-xl" />
        ))}
      </div>

      {/* Main Grid: Schedule and Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Schedule List Skeleton (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-3">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        </div>

        {/* Tasks & Exam Sidebar Skeleton (1 col) */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <SkeletonCard lines={3} />
          </div>

          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

