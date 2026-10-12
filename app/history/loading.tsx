import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="min-h-screen pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 pb-2">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}

