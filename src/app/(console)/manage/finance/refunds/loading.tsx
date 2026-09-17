import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const HEADERS = ["Requested", "Booking", "Customer", "Suite", "Amount", "VAT", "Reason", "Origin", "State"] as const;

export default function FinanceRefundsLoading() {
  return (
    <ConsolePage title="Refunds">
      <StatGridSkeleton cards={4} />
      <FilterBarSkeleton controls={3} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} actionsHeader="Actions" />
    </ConsolePage>
  );
}
