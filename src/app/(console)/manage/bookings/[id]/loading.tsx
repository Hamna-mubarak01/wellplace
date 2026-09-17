import { ConsolePage } from "@/components/console/console-page";
import { DetailSection } from "@/components/console/shared/detail-section";
import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const PAYMENT_HEADERS = ["Recorded", "Method", "Reference", "Status", "Amount", "Refundable"];

function FieldsSkeleton({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function ManageBookingLoading() {
  return (
    <ConsolePage title="Booking" backHref="/manage/bookings" backLabel="Back to bookings">
      <div role="status" aria-live="polite" aria-busy="true" className="flex min-w-0 flex-col gap-6">
        <span className="sr-only">Loading the booking</span>

        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-3">
          <DetailSection title="Visit" className="xl:col-span-2">
            <FieldsSkeleton count={8} className="grid grid-cols-2 gap-4 md:grid-cols-4" />
          </DetailSection>

          <DetailSection title="Payment">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </DetailSection>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <DetailSection title="Customer">
            <FieldsSkeleton count={3} className="flex flex-col gap-4" />
          </DetailSection>
          <DetailSection title="Notes">
            <FieldsSkeleton count={2} className="flex flex-col gap-4" />
          </DetailSection>
        </div>

        <ConsoleDataTableSkeleton headers={PAYMENT_HEADERS} rows={2} />
      </div>
    </ConsolePage>
  );
}
