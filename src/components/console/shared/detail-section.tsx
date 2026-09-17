import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { ConsoleCard } from "@/components/console/console-surface";
import { StatusChip } from "@/components/console/shared/status-chip";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DetailSectionProps {
  title: string;
  Icon?: LucideIcon;
  count?: number;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
  id?: string;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  Icon,
  count,
  actions,
  headingLevel = 2,
  id,
  flush = false,
  children,
  className,
}: DetailSectionProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <ConsoleCard id={id} className={cn("min-w-0 scroll-mt-20", className)}>
      <div className="flex min-h-tap flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 pt-4 pb-3">
        <Heading className="flex min-w-0 items-center gap-2 text-console-body font-semibold text-text-primary">
          {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-brand" />}
          <span className="min-w-0 break-words">{title}</span>
          {count !== undefined && (
            <StatusChip tone="neutral" className="font-data tabular-nums">
              {count.toLocaleString("en-AE")}
            </StatusChip>
          )}
        </Heading>
        {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <CardContent className={cn("min-w-0", flush ? "px-0 pb-0" : "px-5 pb-5")}>{children}</CardContent>
    </ConsoleCard>
  );
}
