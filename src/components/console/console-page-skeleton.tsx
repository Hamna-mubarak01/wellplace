import { Skeleton } from "@/components/ui/skeleton";

export interface ConsolePageSkeletonProps {
  tiles?: number;
  toolbar?: boolean;
  rows?: number;
}

export function ConsolePageSkeleton({
  tiles = 0,
  toolbar = true,
  rows = 6,
}: ConsolePageSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">Loading</span>

      <div className="flex min-h-tap items-center">
        <Skeleton className="h-7 w-40" />
      </div>

      {tiles > 0 && (
        <div className={`grid grid-cols-1 gap-4 ${tiles === 2 ? "sm:grid-cols-2" : tiles === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {Array.from({ length: tiles }, (_, index) => (
            <div
              key={index}
              className="rounded-(--radius-card) border border-border bg-surface-raised px-4 py-4"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {toolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-tap w-full rounded-(--radius-card) sm:max-w-96" />
          <Skeleton className="h-tap w-28 rounded-(--radius-card)" />
        </div>
      )}

      <div className="overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised">
        <div className="flex h-10 items-center gap-4 border-b border-border bg-surface-sunken/40 px-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="hidden h-3 w-24 md:block" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="hidden h-4 w-20 lg:block" />
            <Skeleton className="size-tap rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
