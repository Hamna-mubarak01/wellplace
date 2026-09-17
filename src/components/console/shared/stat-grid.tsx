import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatGridColumns = 2 | 3 | 4 | 5 | 6;

const COLUMNS: Readonly<Record<StatGridColumns, string>> = {
  2: "@xs:grid-cols-2",
  3: "@xs:grid-cols-2 @2xl:grid-cols-3",
  4: "@xs:grid-cols-2 @2xl:grid-cols-4",
  5: "@xs:grid-cols-2 @2xl:grid-cols-3 @4xl:grid-cols-5",
  6: "@xs:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-6",
};

export interface StatGridProps {
  children: ReactNode;
  columns?: StatGridColumns;
  label?: string;
  className?: string;
}

export function StatGrid({ children, columns = 4, label, className }: StatGridProps) {
  return (
    <div className="@container min-w-0">
      <div
        role={label ? "group" : undefined}
        aria-label={label}
        className={cn("grid grid-cols-1 gap-4", COLUMNS[columns], className)}
      >
        {children}
      </div>
    </div>
  );
}
