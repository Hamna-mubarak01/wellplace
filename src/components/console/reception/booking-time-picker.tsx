"use client";

import { useState } from "react";
import { Clock3Icon } from "lucide-react";
import { Button } from "@/components/shared/button";
import type { TimeSlot } from "@/components/shared/time-tile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CLOCK_HOURS, CLOCK_PERIODS, clockLabel, clockParts, type ClockPeriod } from "@/lib/config/clock-picker";
import { formatDubaiTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

const HOURS = [CLOCK_HOURS[CLOCK_HOURS.length - 1], ...CLOCK_HOURS.slice(0, -1)];

const CHIP_CLASS =
  "h-tap min-w-0 cursor-pointer rounded-(--radius-card) border border-border bg-surface-raised px-2 font-data text-console-body tabular-nums text-text-primary transition-colors duration-150 hover:border-brand hover:bg-surface-hover data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:font-medium data-[state=on]:text-brand disabled:cursor-not-allowed disabled:opacity-40";

export function BookingTimePicker({
  slots,
  value,
  onChange,
  disabled,
}: {
  slots: readonly TimeSlot[];
  value: string | null;
  onChange: (startsAt: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const times = slots.map((slot) => {
    const time = formatDubaiTime(slot.startsAt);
    return { ...slot, ...clockParts(time), label: clockLabel(time), available: !slot.tile.disabled };
  });
  const selected = times.find((slot) => slot.startsAt === value && slot.available);
  const firstAvailable = times.find((slot) => slot.available);
  const [period, setPeriod] = useState<ClockPeriod>("AM");
  const [hour, setHour] = useState<string | null>(null);

  const hasAvailable = (nextPeriod: ClockPeriod, nextHour?: string) =>
    times.some((slot) => slot.available && slot.period === nextPeriod && (nextHour === undefined || slot.hour === nextHour));
  const minutes = times.filter((slot) => slot.period === period && slot.hour === hour);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) {
            const start = selected ?? firstAvailable;
            setPeriod(start?.period ?? "AM");
            setHour(start?.hour ?? null);
          }
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            hoverEffect="simple"
            id="walk-in-start-time"
            aria-label={`Start time: ${selected?.label ?? "Choose time"}`}
            disabled={disabled || firstAvailable === undefined}
            className="h-tap w-full justify-between px-3 text-console-body font-normal sm:max-w-xs"
          >
            <span className={cn("font-data tabular-nums", !selected && "text-text-muted")}>{selected?.label ?? "Choose time"}</span>
            <Clock3Icon aria-hidden="true" className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label="Choose start time"
          className="density-console flex w-80 max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) flex-col gap-4 overflow-y-auto border-border bg-surface-raised p-4 text-text-primary"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-console-body font-medium">Start time</p>
            <span className="text-micro text-text-muted">Dubai time</span>
          </div>

          <ToggleGroup
            type="single"
            aria-label="AM or PM"
            value={period}
            onValueChange={(next) => {
              if (next !== "AM" && next !== "PM") return;
              setPeriod(next);
              if (hour === null || !hasAvailable(next, hour)) {
                setHour(times.find((slot) => slot.available && slot.period === next)?.hour ?? null);
              }
            }}
            className="grid w-full grid-cols-2 gap-2 rounded-none"
          >
            {CLOCK_PERIODS.map((option) => (
              <ToggleGroupItem key={option} value={option} disabled={!hasAvailable(option)} className={CHIP_CLASS}>
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex flex-col gap-2">
            <span className="text-micro text-text-secondary">Hour</span>
            <ToggleGroup
              type="single"
              aria-label="Hour"
              value={hour ?? ""}
              onValueChange={(next) => {
                if (next) setHour(next);
              }}
              className="grid w-full grid-cols-4 gap-2 rounded-none"
            >
              {HOURS.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  aria-label={`${option} ${period}`}
                  disabled={!hasAvailable(period, option)}
                  className={CHIP_CLASS}
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-micro text-text-secondary">Minute</span>
            {minutes.length === 0 ? (
              <p className="text-micro text-text-muted">Choose an hour first.</p>
            ) : (
              <ToggleGroup
                type="single"
                aria-label="Minute"
                value={selected && minutes.includes(selected) ? selected.startsAt : ""}
                onValueChange={(next) => {
                  if (!next) return;
                  onChange(next);
                  setOpen(false);
                }}
                className="grid w-full grid-cols-4 gap-2 rounded-none"
              >
                {minutes.map((slot) => (
                  <ToggleGroupItem
                    key={slot.startsAt}
                    value={slot.startsAt}
                    aria-label={`${slot.label}${slot.available ? "" : ", unavailable"}`}
                    disabled={!slot.available}
                    className={CHIP_CLASS}
                  >
                    :{slot.minute}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <p role="status" className="text-micro text-text-secondary">
        {selected ? selected.tile.message ?? "Dubai time · Available" : "Dubai time"}
      </p>
    </div>
  );
}
