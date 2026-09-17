"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HoursDateField({ value, label, disabled, invalid, onChange }: {
  value: string; label: string; disabled?: boolean; invalid?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={invalid ? "text-micro text-danger-ink" : "text-micro text-text-secondary"}>{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" hoverEffect="simple" disabled={disabled} aria-invalid={invalid || undefined} aria-label={label}
            className="h-tap w-full min-w-0 justify-start px-3 font-normal">
            <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{selected ? format(selected, "d MMM yyyy") : "Choose a date"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={8}
          className="density-console settings-popup max-h-(--radix-popover-content-available-height) w-auto max-w-full overflow-y-auto p-0">
          <Calendar className="[--cell-size:var(--spacing-tap)]" mode="single" autoFocus selected={selected} defaultMonth={selected}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
