import { ConsolePage } from "@/components/console/console-page";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const HEADERS = ["Name", "Contact", "Added", "Last activity"] as const;

export default function LeadsLoading() {
  return (
    <ConsolePage title="Leads">
      <FilterBarSkeleton controls={1} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} />
    </ConsolePage>
  );
}
