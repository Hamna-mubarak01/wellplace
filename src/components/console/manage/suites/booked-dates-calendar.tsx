"use client";

import { MonthCalendar } from "@/components/console/manage/suites/month-calendar";
import { formatCalendarDayLong } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export interface BookedDatesCalendarProps {
  month: string;
  today: string;
  dates: readonly { date: string; bookings: number }[];
}

function bookingsLabel(count: number): string {
  if (count === 0) return "no bookings";
  return count === 1 ? "1 booking" : `${count} bookings`;
}

export function BookedDatesCalendar({ month, today, dates }: BookedDatesCalendarProps) {
  const counts = new Map(dates.map((entry) => [entry.date, entry.bookings]));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MonthCalendar
        month={month}
        today={today}
        renderDay={(isoDate) => {
          const count = counts.get(isoDate) ?? 0;
          const isToday = isoDate === today;
          return {
            label: `${formatCalendarDayLong(isoDate)}${isToday ? ", today" : ""}, ${bookingsLabel(count)}`,
            content: (
              <div
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-(--radius-control) border px-1 py-1",
                  count > 0 ? "border-brand bg-brand-wash text-text-primary" : "border-transparent text-text-secondary",
                  isToday && count === 0 && "border-border-strong",
                )}
              >
                <span className={cn("font-data text-console-table tabular-nums", isToday && "font-semibold text-text-primary")}>
                  {Number(isoDate.slice(8))}
                </span>
                {count > 0 && (
                  <span className="font-data text-micro font-medium tabular-nums">{count}</span>
                )}
              </div>
            ),
          };
        }}
      />
      <p className="flex flex-wrap items-center gap-2 text-micro text-text-secondary">
        <span aria-hidden="true" className="size-3 shrink-0 rounded-xs border border-brand bg-brand-wash" />
        Booked. The number is how many bookings start or run that day.
      </p>
    </div>
  );
}
