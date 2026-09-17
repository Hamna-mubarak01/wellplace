import { ConsolePage } from "@/components/console/console-page";
import { ConsoleCard } from "@/components/console/console-surface";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ManageBookingReceiptLoading() {
  return (
    <ConsolePage title="Receipt" backHref="/manage/bookings" backLabel="Back to bookings">
      <ConsoleCard className="w-full max-w-3xl">
        <CardContent role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
          <span className="sr-only">Preparing the receipt</span>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </ConsoleCard>
    </ConsolePage>
  );
}
