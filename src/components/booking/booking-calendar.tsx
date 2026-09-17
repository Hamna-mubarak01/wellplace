"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";

import { fromDateKey, toDateKey } from "@/components/booking/booking-date";
import type { BookingDay } from "@/components/booking/booking-types";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { useMinWidth } from "@/hooks/use-min-width";
import { cn } from "@/lib/utils";


export interface BookingCalendarProps {
  days: readonly BookingDay[];
  value: string;
  onValueChange: (dateKey: string) => void;
  className?: string;
}

const CELL_SIZE = { "--cell-size": "var(--tap-min)" } as CSSProperties;

const TWO_MONTH_MIN_WIDTH = 1024;

function DayCell(props: React.ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton
      {...props}
      className="aspect-auto h-day-cell w-full min-w-0"
    />
  );
}

export function BookingCalendar({
  days,
  value,
  onValueChange,
  className,
}: BookingCalendarProps) {
  const numberOfMonths = useMinWidth(TWO_MONTH_MIN_WIDTH) ? 2 : 1;

  const openKeys = useMemo(
    () => new Set(days.filter((day) => day.status === "open").map((day) => day.date)),
    [days],
  );

  const firstBookable = useMemo(
    () =>
      days.find(
        (day) =>
          day.status === "open" &&
          Object.values(day.slotsByDuration).some((slots) =>
            slots.some((slot) => !slot.tile.disabled),
          ),
      ),
    [days],
  );

  const first = days[0];
  const last = days[days.length - 1];

  const monthsInWindow = useMemo(() => {
    if (!first || !last) return 0;
    const from = fromDateKey(first.date);
    const to = fromDateKey(last.date);
    return (
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth()) +
      1
    );
  }, [first, last]);

  const hideNavigation = monthsInWindow <= numberOfMonths;

  const defaultMonthKey =
    openKeys.has(value) && (!firstBookable || value > firstBookable.date)
      ? value
      : (firstBookable?.date ?? first?.date);

  return (
    <Calendar
      mode="single"
      required
      numberOfMonths={numberOfMonths}
      hideNavigation={hideNavigation}
      showOutsideDays={false}
      selected={fromDateKey(value)}
      onSelect={(date: Date) => onValueChange(toDateKey(date))}
      defaultMonth={defaultMonthKey ? fromDateKey(defaultMonthKey) : undefined}
      startMonth={first ? fromDateKey(first.date) : undefined}
      endMonth={last ? fromDateKey(last.date) : undefined}
      disabled={(date: Date) => !openKeys.has(toDateKey(date))}
      style={CELL_SIZE}
      className={cn("w-full bg-transparent p-0", className)}
      classNames={{
        months: "relative flex w-full flex-col gap-8 lg:flex-row",
        month: "flex w-full min-w-0 flex-col gap-3 lg:gap-4",
        week: "mt-1 flex w-full lg:mt-2",
        day: "group/day h-day-cell w-full select-none p-0 text-center",
      }}
      components={{ DayButton: DayCell }}
    />
  );
}
