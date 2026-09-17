import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";


export interface BookingStepPanelProps {
  index: number;
  title: string;
  description?: string;
  id: string;
  revealDelayMs?: number;
  children: ReactNode;
  className?: string;
}

export function BookingStepPanel({
  index,
  title,
  description,
  id,
  revealDelayMs = 0,
  children,
  className,
}: BookingStepPanelProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      style={{ "--reveal-delay": `${revealDelayMs}ms` } as CSSProperties}
      className={cn(
        "step-reveal scroll-mt-6 rounded-(--radius-modal) border border-border bg-surface-raised p-4 shadow-(--shadow-sm) sm:p-6",
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden
          className="font-data text-label text-brand tabular-nums"
        >
          {String(index).padStart(2, "0")}
        </span>
        <h2 id={headingId} className="font-display text-h3 text-text-primary">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="mt-1.5 text-small text-pretty text-text-secondary">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
