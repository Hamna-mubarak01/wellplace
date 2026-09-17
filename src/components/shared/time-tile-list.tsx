"use client";

import { TimeTile, type TimeSlot } from "@/components/shared/time-tile";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";


export interface TimeTileListProps {
  slots: readonly TimeSlot[];
  value: string | null;
  onValueChange: (startsAt: string | null) => void;
  onHoldExpire?: (startsAt: string) => void;
  showAvailability?: boolean;
  label: string;
  layout?: "list" | "grid";
  className?: string;
}

export function TimeTileList({
  slots,
  value,
  onValueChange,
  onHoldExpire,
  showAvailability = true,
  label,
  layout = "list",
  className,
}: TimeTileListProps) {
  const isGrid = layout === "grid";

  return (
    <ToggleGroup
      type="single"
      orientation={isGrid ? "horizontal" : "vertical"}
      aria-label={label}
      value={value ?? ""}
      onValueChange={(next) => onValueChange(next === "" ? null : next)}
      className={cn(
        "w-full rounded-none",
        isGrid
          ? "grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 md:grid-cols-4"
          : "flex-col items-stretch gap-2",
        className,
      )}
    >
      {slots.map((slot) => (
        <TimeTile
          key={slot.startsAt}
          slot={slot}
          onHoldExpire={onHoldExpire}
          showAvailability={showAvailability}
          className={isGrid ? "px-3" : undefined}
        />
      ))}
    </ToggleGroup>
  );
}
