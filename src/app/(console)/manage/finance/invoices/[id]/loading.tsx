import { ConsoleCard } from "@/components/console/console-surface";
import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceInvoiceLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-console flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <span className="sr-only">Loading invoice</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="size-tap rounded-(--radius-button)" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-control w-24 rounded-(--radius-button)" />
          <Skeleton className="h-control w-28 rounded-(--radius-button)" />
          <Skeleton className="h-control w-40 rounded-(--radius-button)" />
        </div>
      </div>
      <ConsoleCard>
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap justify-between gap-6 border-b border-border pb-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
          <div className="grid gap-6 border-b border-border pb-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex justify-between gap-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
          <div className="ml-auto flex w-full max-w-md flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        </div>
      </ConsoleCard>
    </div>
  );
}
