import { ConsolePage } from "@/components/console/console-page";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const HEADERS = ["Rate", "Regular per hour", "Offer per hour", "Status"] as const;

export default function CatalogueLoading() {
  return (
    <ConsolePage title="Prices and add-ons">
      <FilterBarSkeleton controls={0} />
      <div aria-hidden="true" className="flex min-w-0 gap-2 border-b border-border pb-1.5">
        <Skeleton className="h-tap w-32 rounded-(--radius-control)" />
        <Skeleton className="h-tap w-24 rounded-(--radius-control)" />
      </div>
      <ConsoleDataTableSkeleton headers={HEADERS} rows={4} actionsHeader="Actions" />
      <Skeleton aria-hidden="true" className="h-control w-full rounded-(--radius-card)" />
    </ConsolePage>
  );
}
