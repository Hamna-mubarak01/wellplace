import { ConsoleCard } from "@/components/console/console-surface";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceCreditNoteLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">Loading credit note</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-tap rounded-(--radius-button)" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-control w-36 rounded-(--radius-button)" />
          <Skeleton className="h-control w-24 rounded-(--radius-button)" />
        </div>
      </div>
      {Array.from({ length: 2 }, (_, section) => (
        <ConsoleCard key={section}>
          <div className="flex flex-col gap-4 px-5 py-5">
            <Skeleton className="h-5 w-32" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, field) => (
                <div key={field} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        </ConsoleCard>
      ))}
    </div>
  );
}
