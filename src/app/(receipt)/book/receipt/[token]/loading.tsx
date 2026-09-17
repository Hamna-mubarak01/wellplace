import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ReceiptLoading() {
  return (
    <div className="receipt-backdrop relative isolate flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-5 sm:pt-8">
        <Skeleton className="h-tap w-40" />
        <Skeleton className="h-6 w-28" />
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8 pb-16 sm:gap-8 sm:pt-12">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
        <Card className="gap-0 overflow-hidden rounded-(--radius-modal) border border-border bg-surface-raised py-0">
          <CardContent className="flex flex-col gap-8 p-5 sm:p-8">
            <div className="grid gap-8 sm:grid-cols-2">
              {[0, 1].map((column) => (
                <div key={column} className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-24" />
                  {Array.from({ length: 4 }).map((_, row) => (
                    <Skeleton key={row} className="h-5 w-full" />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-16" />
              {Array.from({ length: 3 }).map((_, row) => (
                <Skeleton key={row} className="h-5 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-control w-full" />
          <Skeleton className="h-control w-full" />
        </div>
      </main>
    </div>
  );
}
