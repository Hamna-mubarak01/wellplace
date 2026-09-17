import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const STATS = ["Active", "Expiring soon", "Used up", "Expired"] as const;

const HEADERS = ["Code", "Batch", "Discount", "Valid through", "Uses", "Status"] as const;

export default function CouponsLoading() {
  return (
    <ConsolePage title="Coupons">
      <StatGridSkeleton labels={STATS} columns={4} />
      <FilterBarSkeleton controls={3} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={6} actionsHeader="Actions" />
    </ConsolePage>
  );
}
