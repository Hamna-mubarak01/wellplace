import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SuiteDrawerSectionProps {
  id: string;
  title: string;
  control?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SuiteDrawerSection({ id, title, control, children, className }: SuiteDrawerSectionProps) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id={id} className="text-console-body font-semibold text-text-primary">
          {title}
        </h3>
        {control}
      </div>
      {children}
    </section>
  );
}
