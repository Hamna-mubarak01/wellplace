import { Skeleton } from "@/components/ui/skeleton";

export interface FilterBarSkeletonProps {
  search?: boolean;
  controls?: number;
  quickFilter?: boolean;
}

export function FilterBarSkeleton({ search = true, controls = 2, quickFilter = false }: FilterBarSkeletonProps) {
  return (
    <div aria-hidden="true" className="@container min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {search && (
          <Skeleton className="h-control min-w-0 flex-1 basis-full rounded-(--radius-control) @lg:basis-72" />
        )}
        {quickFilter && (
          <Skeleton className="h-control basis-full rounded-(--radius-control) @xs:w-40 @xs:basis-auto" />
        )}
        {controls > 0 && (
          <Skeleton className="h-control basis-full rounded-(--radius-control) @xs:w-(--measure-filter-select) @xs:basis-auto" />
        )}
      </div>
    </div>
  );
}
