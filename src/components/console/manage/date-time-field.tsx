"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { TimeSelect } from "@/components/console/manage/time-select";
import { formatCalendarDayLong } from "@/lib/domain/time";
import { Button } from "@/components/shared/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function split(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date: ISO_DATE.test(date) ? date : "", time };
}

function toIsoDate(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function fromIsoDate(value: string): Date | undefined {
  if (!ISO_DATE.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export interface DateTimeFieldProps {
  value: string;
  label: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function DateTimeField({
  value,
  label,
  disabled = false,
  onChange,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const { date, time } = split(value);

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`${label}, date`}
            className="h-tap w-full min-w-0 justify-start sm:w-auto sm:flex-1 px-3 text-console-body font-normal"
          >
            <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              {date ? formatCalendarDayLong(date) : "Choose a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={8} className="max-h-(--radix-popover-content-available-height) w-auto max-w-full overflow-y-auto p-0">
          <Calendar
            className="[--cell-size:var(--spacing-tap)]"
            mode="single"
            autoFocus
            selected={fromIsoDate(date)}
            defaultMonth={fromIsoDate(date)}
            onSelect={(day) => {
              if (!day) return;
              onChange(`${toIsoDate(day)}T${time || "00:00"}`);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <TimeSelect
        label={label}
        value={time}
        disabled={disabled}
        onChange={(next) => onChange(`${date}T${next}`)}
      />
    </div>
  );
}
