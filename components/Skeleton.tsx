import React from "react";

export function Skeleton({
  className = "",
  rounded = "rounded-xl",
}: {
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface border border-line-subtle/40 animate-pulse ${rounded} ${className}`}
    />
  );
}

export function SkeletonCard({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`p-5 rounded-2xl bg-surface-elevated border border-line shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
      <div className="space-y-2 pt-1">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3.5 ${i === lines - 1 ? "w-4/6" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
