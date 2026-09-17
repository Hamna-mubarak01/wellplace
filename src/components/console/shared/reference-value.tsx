import { EmptyValue } from "@/components/console/shared/empty-value";
import { referenceParts } from "@/components/console/shared/reference-display";
import { cn } from "@/lib/utils";

export interface ReferenceValueProps {
  reference?: string | null;
  secondary?: string | null;
  emptyLabel?: string;
  className?: string;
}

export function ReferenceValue({ reference, secondary, emptyLabel = "No reference", className }: ReferenceValueProps) {
  const parts = referenceParts(reference, secondary);

  if (parts.primary === null) return <EmptyValue label={emptyLabel} className={className} />;

  return (
    <div className={cn("min-w-0", className)}>
      <span className="block font-data tabular-nums break-all">{parts.primary}</span>
      {parts.secondary && (
        <span className="mt-0.5 block font-data text-micro tabular-nums break-all text-text-muted">
          {parts.secondary}
        </span>
      )}
    </div>
  );
}
