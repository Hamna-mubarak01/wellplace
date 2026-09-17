"use client";

import { useState } from "react";
import { CLOCK_HOURS, CLOCK_MINUTES, CLOCK_PERIODS, clockParts, clockValue, clockLabel, type ClockPeriod } from "@/lib/config/clock-picker";
import { Button } from "@/components/shared/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";

export function ClockPicker({ value, label, disabled = false, onChange }: {
  value: string; label: string; disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parts = clockParts(value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" hoverEffect="simple" aria-label={`${label}: ${clockLabel(value)}`} disabled={disabled} className="h-tap w-full min-w-0 px-2 font-data text-micro font-normal tabular-nums">{clockLabel(value)}</Button></PopoverTrigger>
    <PopoverContent align="center" collisionPadding={12} aria-label={label} className="density-console settings-popup flex w-72 flex-col max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) overflow-y-auto gap-4 border border-border bg-surface-raised p-4 text-text-primary motion-reduce:animate-none">
      <p className="text-console-body font-medium">Choose time</p>
      <div className="grid grid-cols-3 gap-2">
        {([{ name: "Hour", value: parts.hour, options: CLOCK_HOURS, change: (hour: string) => onChange(clockValue({ ...parts, hour })) }, { name: "Minute", value: parts.minute, options: CLOCK_MINUTES, change: (minute: string) => onChange(clockValue({ ...parts, minute })) }, { name: "AM or PM", value: parts.period, options: CLOCK_PERIODS, change: (period: string) => onChange(clockValue({ ...parts, period: period as ClockPeriod })) }]).map((part) => <div key={part.name} className="flex min-w-0 flex-col gap-2">
          <span className="text-micro text-text-secondary">{part.name}</span>
          <Select value={part.value} disabled={disabled} onValueChange={part.change}><SelectTrigger aria-label={`${label}, ${part.name.toLowerCase()}`} className="min-h-tap w-full px-2 font-data text-micro"><SelectValue /></SelectTrigger><SelectContent className="settings-popup max-h-64">{part.options.map((option) => <SelectItem key={option} value={option} className="min-h-tap font-data">{option}</SelectItem>)}</SelectContent></Select>
        </div>)}
      </div>
      <Button type="button" size="sm" className="w-full" onClick={() => setOpen(false)}>Done</Button>
    </PopoverContent>
  </Popover>;
}
