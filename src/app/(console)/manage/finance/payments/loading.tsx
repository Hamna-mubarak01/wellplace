import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const HEADERS = ["Date", "Booking", "Customer", "Suite", "Method", "Amount", "Status"] as const;

export default function FinancePaymentsLoading() {
  return (
    <ConsolePage title="Payments">
      <StatGridSkeleton cards={4} />
      <FilterBarSkeleton controls={4} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} actionsHeader="Actions" />
    </ConsolePage>
  );
}
