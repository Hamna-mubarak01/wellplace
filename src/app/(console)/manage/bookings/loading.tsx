import { ConsolePage } from "@/components/console/console-page";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { StatCard } from "@/components/console/shared/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { BOOKINGS_TABLE_HEADERS } from "@/components/console/manage/bookings/bookings-table";

const SUMMARY_LABELS = [
  "Today",
  "Upcoming",
  "In the suite now",
  "Needs attention",
  "Cancelled this month",
] as const;

export default function ManageBookingsLoading() {
  return (
    <ConsolePage title="Bookings">
      <StatGrid columns={5} label="Bookings summary">
        {SUMMARY_LABELS.map((label) => (
          <StatCard key={label} label={label} value={<Skeleton className="h-7 w-12" />} />
        ))}
      </StatGrid>
      <FilterBarSkeleton controls={5} />
      <ConsoleDataTableSkeleton headers={BOOKINGS_TABLE_HEADERS} rows={8} />
    </ConsolePage>
  );
}
