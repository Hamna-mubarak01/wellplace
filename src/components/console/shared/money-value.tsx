import { EmptyValue } from "@/components/console/shared/empty-value";
import { formatAed } from "@/components/shared/money";
import { cn } from "@/lib/utils";

export interface MoneyValueProps {
  fils: number | null | undefined;
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function MoneyValue({ fils, compact = false, emptyLabel, className }: MoneyValueProps) {
  if (fils === null || fils === undefined || !Number.isFinite(fils)) {
    return <EmptyValue label={emptyLabel} className={className} />;
  }

  return (
    <span className={cn("font-data tabular-nums whitespace-nowrap", className)}>
      {formatAed(fils, { compact })}
    </span>
  );
}
