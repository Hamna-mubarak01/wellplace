import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIONS = 4;
const TABS = 3;
const FIELDS = 6;
const WEEKS = 5;
const DAYS_PER_WEEK = 7;

export function SuiteDrawerSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex min-h-0 flex-1 flex-col">
      <SheetTitle className="sr-only">Loading suite</SheetTitle>
      <SheetDescription className="sr-only">The suite is loading.</SheetDescription>

      <div className="@container flex shrink-0 flex-col gap-4 border-b border-border p-5">
        <div className="flex min-h-tap items-center gap-3 pr-dialog-close">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 @md:flex">
          {Array.from({ length: ACTIONS }, (_, action) => (
            <Skeleton key={action} className="h-tap w-full rounded-(--radius-button) @md:w-24" />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-6 border-b border-border px-5 py-3">
        {Array.from({ length: TABS }, (_, tab) => (
          <Skeleton key={tab} className="h-5 w-16" />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden p-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: FIELDS }, (_, field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-tap w-40 rounded-(--radius-button)" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: WEEKS * DAYS_PER_WEEK }, (_, cell) => (
              <Skeleton key={cell} className="h-12 rounded-(--radius-control)" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
