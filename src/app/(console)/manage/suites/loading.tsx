import { ConsolePage } from "@/components/console/console-page";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { CONSOLE_SURFACE } from "@/components/console/console-surface";

const TILES = 4;
const CARDS = 8;

function SuiteCardSkeleton() {
  return (
    <div className={`${CONSOLE_SURFACE} flex h-full flex-col items-center gap-3 p-5`}>
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-9 w-10" />
      <Skeleton className="h-6 w-24 rounded-full" />
      <div className="mt-auto flex w-full flex-col items-center gap-2 border-t border-border pt-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

export default function ManageSuitesLoading() {
  return (
    <ConsolePage title="Suites">
      <div role="status" aria-live="polite" aria-busy="true" className="flex min-w-0 flex-col gap-6">
        <span className="sr-only">Loading suites</span>

        <StatGrid columns={TILES}>
          {Array.from({ length: TILES }, (_, tile) => (
            <div key={tile} className={`${CONSOLE_SURFACE} flex min-h-console-tile flex-col justify-between gap-2 p-4`}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </StatGrid>

        <FilterBarSkeleton controls={1} />

        <div className="@container min-w-0">
          <div className="grid auto-rows-fr grid-cols-1 gap-4 @md:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-4">
            {Array.from({ length: CARDS }, (_, card) => (
              <SuiteCardSkeleton key={card} />
            ))}
          </div>
        </div>
      </div>
    </ConsolePage>
  );
}
