import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function AnnouncementsLoading() {
  return (
    <div className="min-h-screen pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>

      {/* Search & Filter Skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-11 w-full max-w-md rounded-xl" />
      </div>

      {/* Announcements List Skeleton */}
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

