import { ConsolePage } from "@/components/console/console-page";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const HEADERS = ["Name", "Contact", "Bookings", "Paid"] as const;

export default function BlockedCustomersLoading() {
  return (
    <ConsolePage title="Blocked">
      <FilterBarSkeleton controls={0} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} actionsHeader="Actions" />
    </ConsolePage>
  );
}
