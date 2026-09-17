import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


export interface TimeTileSkeletonProps {
  count?: number;
  className?: string;
}

export function TimeTileSkeleton({ count = 7, className }: TimeTileSkeletonProps) {
  return (
    <div aria-hidden className={cn("flex w-full flex-col gap-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex min-h-tap flex-col justify-center gap-1.5 rounded-(--radius-card) border border-border bg-surface-raised px-4 py-2.5"
        >
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
