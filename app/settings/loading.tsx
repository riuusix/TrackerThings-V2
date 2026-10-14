import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="min-h-screen pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="space-y-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Settings Sections Skeleton */}
      <div className="space-y-6">
        {/* Profile Section */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Security Section */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

