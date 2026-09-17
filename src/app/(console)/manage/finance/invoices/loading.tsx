import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const HEADERS = ["Number", "Type", "Issued", "Customer", "Booking", "Total", "VAT", "State"] as const;

export default function FinanceInvoicesLoading() {
  return (
    <ConsolePage title="Invoices">
      <StatGridSkeleton cards={4} />
      <FilterBarSkeleton controls={1} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} actionsHeader="Actions" />
    </ConsolePage>
  );
}
