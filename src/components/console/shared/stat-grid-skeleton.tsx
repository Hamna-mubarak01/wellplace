import { ConsoleCard, ConsoleCardBody } from "@/components/console/console-surface";
import { StatGrid, type StatGridColumns } from "@/components/console/shared/stat-grid";
import { Skeleton } from "@/components/ui/skeleton";

export type StatGridSkeletonProps =
  | { readonly labels: readonly string[]; readonly columns: StatGridColumns }
  | { readonly cards: StatGridColumns };

export function StatGridSkeleton(props: StatGridSkeletonProps) {
  const columns = "labels" in props ? props.columns : props.cards;
  const cards = "labels" in props ? props.labels : Array.from({ length: props.cards }, (_, index) => `card-${index}`);
  const showLabels = "labels" in props;

  return (
    <div aria-hidden="true">
      <StatGrid columns={columns}>
        {cards.map((card) => (
          <ConsoleCard key={card} className="h-full">
            <ConsoleCardBody className="flex h-full min-h-console-tile flex-col justify-between gap-2">
              {showLabels ? (
                <p className="text-console-label tracking-label text-text-muted uppercase">{card}</p>
              ) : (
                <Skeleton className="h-3 w-24" />
              )}
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28 max-w-full" />
            </ConsoleCardBody>
          </ConsoleCard>
        ))}
      </StatGrid>
    </div>
  );
}
