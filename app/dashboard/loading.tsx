import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Navbar Skeleton */}
      <div className="h-16 border-b border-line bg-canvas/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="w-36 h-6 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="w-28 h-9 rounded-xl" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-line">
          <div className="space-y-2">
            <Skeleton className="w-36 h-4 rounded-md" />
            <Skeleton className="w-64 h-8 rounded-xl" />
            <Skeleton className="w-80 h-4 rounded-md" />
          </div>
          <div className="flex gap-2.5">
            <Skeleton className="w-36 h-10 rounded-xl" />
            <Skeleton className="w-36 h-10 rounded-xl" />
          </div>
        </div>

        {/* Academic Briefing Strip Skeleton */}
        <div className="rounded-2xl bg-surface-elevated border border-line p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="w-full h-14 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Dashboard Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl p-6 bg-surface-elevated border border-line space-y-4">
              <Skeleton className="w-48 h-6 rounded-lg" />
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="w-16 h-8 rounded-lg" />
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <Skeleton className="w-full h-20 rounded-xl" />
                <Skeleton className="w-full h-20 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl p-6 bg-surface-elevated border border-line space-y-4">
              <Skeleton className="w-40 h-6 rounded-lg" />
              <div className="space-y-2.5">
                <Skeleton className="w-full h-16 rounded-xl" />
                <Skeleton className="w-full h-16 rounded-xl" />
                <Skeleton className="w-full h-16 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
