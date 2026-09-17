import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DetailFieldGridColumns = 2 | 3 | 4;

const COLUMNS: Readonly<Record<DetailFieldGridColumns, string>> = {
  2: "@md:grid-cols-2",
  3: "@md:grid-cols-2 @2xl:grid-cols-3",
  4: "@md:grid-cols-2 @2xl:grid-cols-4",
};

export interface DetailFieldGridProps {
  children: ReactNode;
  columns?: DetailFieldGridColumns;
  className?: string;
}

export function DetailFieldGrid({ children, columns = 3, className }: DetailFieldGridProps) {
  return (
    <div className="@container min-w-0">
      <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", COLUMNS[columns], className)}>
        {children}
      </dl>
    </div>
  );
}
