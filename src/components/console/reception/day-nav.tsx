import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { formatCalendarDayLong, todayInDubai } from "@/lib/domain/time";
import { Button } from "@/components/shared/button";

export function shiftCalendarDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export interface DayNavProps {
  basePath: string;
  date: string;
  step?: number;
}

export function DayNav({ basePath, date, step = 1 }: DayNavProps) {
  const href = (target: string) => `${basePath}?date=${target}`;
  const today = todayInDubai();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-(--radius-card) border border-border bg-surface-raised p-1">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Previous day">
          <Link href={href(shiftCalendarDate(date, -step))}>
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
          </Link>
        </Button>

        <p className="min-w-0 px-2 font-data text-console-body tabular-nums text-text-primary">
          {formatCalendarDayLong(date)}
        </p>

        <Button asChild variant="ghost" size="icon-sm" aria-label="Next day">
          <Link href={href(shiftCalendarDate(date, step))}>
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>

      {date !== today && (
        <Button asChild variant="outline" size="sm">
          <Link href={href(today)}>Today</Link>
        </Button>
      )}
    </div>
  );
}
