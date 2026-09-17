import type { ReactNode } from "react";

import { EmptyValue } from "@/components/console/shared/empty-value";
import { cn } from "@/lib/utils";

export interface DetailFieldProps {
  label: string;
  value?: ReactNode;
  emptyLabel?: string;
  data?: boolean;
  span?: 2 | "full";
  className?: string;
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === false || value === "";
}

export function DetailField({
  label,
  value,
  emptyLabel,
  data = false,
  span,
  className,
}: DetailFieldProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        span === 2 && "@md:col-span-2",
        span === "full" && "col-span-full",
        className,
      )}
    >
      <dt className="text-console-label tracking-label text-text-muted uppercase">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-console-body font-medium break-words text-text-primary",
          data && "font-data tabular-nums",
        )}
      >
        {isEmpty(value) ? <EmptyValue label={emptyLabel} /> : value}
      </dd>
    </div>
  );
}
