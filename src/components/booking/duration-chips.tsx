"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";


export interface DurationChipsProps {
  durationsHours: readonly number[];
  value: number;
  onValueChange: (durationHours: number) => void;
  priceFrom?: Readonly<Record<number, string>>;
  className?: string;
}

export function DurationChips({
  durationsHours,
  value,
  onValueChange,
  priceFrom,
  className,
}: DurationChipsProps) {
  return (
    <ToggleGroup
      type="single"
      aria-label="Session length"
      value={String(value)}
      onValueChange={(next) => {
        if (next !== "") onValueChange(Number(next));
      }}
      className={cn(
        "grid w-full grid-cols-[repeat(auto-fit,minmax(var(--measure-duration),1fr))] gap-2 rounded-none",
        className,
      )}
    >
      {durationsHours.map((hours) => (
        <ToggleGroupItem
          key={hours}
          value={String(hours)}
          className={cn(
            "group/chip flex h-auto min-h-tap w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-(--radius-card) border border-border bg-surface-raised px-3 py-2 transition-colors duration-150",
            "hover:border-brand hover:bg-surface-hover",
            "data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:ring-1 data-[state=on]:ring-brand",
          )}
        >
          <span className="text-control font-medium text-text-primary group-data-[state=on]/chip:font-bold group-data-[state=on]/chip:text-brand">
            <span className="font-data tabular-nums">{hours}</span>
            <span className="ml-1">{hours === 1 ? "hour" : "hours"}</span>
          </span>
          {priceFrom?.[hours] ? (
            <span className="block min-h-price-line text-fine text-text-secondary tabular-nums">
              {priceFrom[hours]}
            </span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
