import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8 animate-in fade-in duration-200">
      {/* Banner & Avatar Skeleton */}
      <div className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
          <Skeleton className="w-24 h-24 rounded-2xl shrink-0" />
          <div className="space-y-2 text-center sm:text-left flex-1">
            <Skeleton className="h-7 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-36 mx-auto sm:mx-0" />
          </div>
        </div>
      </div>

      {/* Stats Counter Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>

      {/* Details Skeleton */}
      <SkeletonCard lines={4} />
    </div>
  );
}

