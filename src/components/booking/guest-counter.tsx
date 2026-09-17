"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";


export interface GuestCounterProps {
  id: string;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (next: number) => void;
  decrementLabel: string;
  incrementLabel: string;
  className?: string;
}

const STEP_BUTTON_CLASS =
  "size-tap shrink-0 rounded-(--radius-card) border-border bg-surface-raised text-text-primary hover:border-brand hover:bg-surface-hover disabled:opacity-40";

export function GuestCounter({
  id,
  label,
  description,
  value,
  min,
  max,
  onValueChange,
  decrementLabel,
  incrementLabel,
  className,
}: GuestCounterProps) {
  const labelId = `${id}-label`;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("flex items-center justify-between gap-4 py-1", className)}
    >
      <div className="min-w-0">
        <p id={labelId} className="text-body font-medium text-text-primary">
          {label}
        </p>
        {description ? (
          <p className="text-fine text-pretty text-text-secondary">{description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={decrementLabel}
          disabled={value <= min}
          onClick={() => onValueChange(value - 1)}
          className={STEP_BUTTON_CLASS}
        >
          <MinusIcon aria-hidden />
        </Button>
        <span
          aria-live="polite"
          className="w-9 text-center font-data text-body tabular-nums text-text-primary"
        >
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={incrementLabel}
          disabled={value >= max}
          onClick={() => onValueChange(value + 1)}
          className={STEP_BUTTON_CLASS}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
