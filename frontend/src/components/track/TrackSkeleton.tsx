import { Skeleton } from "@/components/ui/SkeletonLoader";

export function TrackSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: "var(--bg-surface)" }}>
      <Skeleton className="h-16 w-16 flex-shrink-0 rounded" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
