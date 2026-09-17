import { IdCardIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { DetailSection } from "@/components/console/shared/detail-section";
import { Skeleton } from "@/components/ui/skeleton";

const FIELDS = [
  "Salutation",
  "First name",
  "Last name",
  "Date of birth",
  "Email",
  "Phone",
  "Phone country",
  "Customer since",
] as const;

const STATS = ["Bookings", "Completed", "Upcoming", "Paid total", "Last visit"] as const;

const BOOKING_HEADERS = ["Reference", "Suite", "Visit", "Status", "Total"] as const;

export default function CustomerLoading() {
  return (
    <ConsolePage title="Customer" backHref="/manage/customers" backLabel="Back to customers">
      <div aria-busy="true" className="flex min-w-0 flex-col gap-6">
        <DetailSection title="Personal information" Icon={IdCardIcon}>
          <div className="@container min-w-0">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 @md:grid-cols-2 @2xl:grid-cols-4">
              {FIELDS.map((field) => (
                <div key={field} className="flex min-w-0 flex-col gap-1">
                  <span className="text-console-label tracking-label text-text-muted uppercase">{field}</span>
                  <Skeleton className="h-5 w-32 max-w-full" />
                </div>
              ))}
            </div>
          </div>
        </DetailSection>

        <StatGridSkeleton labels={STATS} columns={5} />

        <div aria-hidden="true" className="flex min-w-0 gap-2 border-b border-border pb-1.5">
          <Skeleton className="h-tap w-24 rounded-(--radius-control)" />
          <Skeleton className="h-tap w-24 rounded-(--radius-control)" />
          <Skeleton className="h-tap w-28 rounded-(--radius-control)" />
        </div>

        <ConsoleDataTableSkeleton headers={BOOKING_HEADERS} rows={5} />
      </div>
    </ConsolePage>
  );
}
