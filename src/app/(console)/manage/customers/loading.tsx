import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const STATS = ["Customers", "Returning", "Upcoming visits"] as const;

const HEADERS = ["Name", "Contact", "Bookings", "Last visit", "Upcoming", "Paid"] as const;

export default function CustomersLoading() {
  return (
    <ConsolePage title="Customers">
      <StatGridSkeleton labels={STATS} columns={3} />
      <FilterBarSkeleton controls={1} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} />
    </ConsolePage>
  );
}
