import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";

const STATS = ["On the list", "Joined recently"] as const;

const HEADERS = ["Name", "Mobile", "Age", "Arrived via", "Joined"] as const;

export default function WaitlistLoading() {
  return (
    <ConsolePage title="Waitlist">
      <StatGridSkeleton labels={STATS} columns={2} />
      <FilterBarSkeleton controls={2} />
      <ConsoleDataTableSkeleton headers={HEADERS} rows={8} actionsHeader="Actions" />
    </ConsolePage>
  );
}
