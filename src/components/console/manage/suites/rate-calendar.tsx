"use client";

import { ClockIcon } from "lucide-react";

import { MonthCalendar } from "@/components/console/manage/suites/month-calendar";
import { formatAed } from "@/components/shared/money";
import { formatCalendarDayLong } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export interface DailyRateView {
  readonly isoDate: string;
  readonly regularFilsPerHour: number | null;
  readonly offerFilsPerHour: number | null;
  readonly varies: boolean;
}

export interface RateCalendarProps {
  month: string;
  today: string;
  rates: readonly DailyRateView[];
}

function amount(fils: number): string {
  return formatAed(fils, { compact: true }).replace("AED ", "");
}

function rateLabel(rate: DailyRateView | undefined): string {
  if (rate === undefined || rate.offerFilsPerHour === null) return "no rate set";
  const parts = [`${formatAed(rate.offerFilsPerHour, { compact: true })} per hour`];
  if (rate.regularFilsPerHour !== null && rate.regularFilsPerHour > rate.offerFilsPerHour) {
    parts.push(`regular ${formatAed(rate.regularFilsPerHour, { compact: true })}`);
  }
  if (rate.varies) parts.push("varies by start time");
  return parts.join(", ");
}

export function RateCalendar({ month, today, rates }: RateCalendarProps) {
  const byDate = new Map(rates.map((rate) => [rate.isoDate, rate]));

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MonthCalendar
        month={month}
        today={today}
        renderDay={(isoDate) => {
          const rate = byDate.get(isoDate);
          const past = isoDate < today;
          const offer = rate?.offerFilsPerHour ?? null;
          const regular = rate?.regularFilsPerHour ?? null;
          return {
            label: `${formatCalendarDayLong(isoDate)}: ${rateLabel(rate)}`,
            content: (
              <div
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-(--radius-control) border px-1 py-1.5",
                  past ? "border-transparent bg-surface-sunken text-text-muted" : "border-border bg-surface-raised text-text-secondary",
                  isoDate === today && "border-border-strong",
                )}
              >
                <span className="font-data text-micro tabular-nums">{Number(isoDate.slice(8))}</span>
                {offer === null ? (
                  <span className="font-data text-micro">—</span>
                ) : (
                  <span className={cn("font-data text-console-table font-medium tabular-nums", !past && "text-text-primary")}>
                    {amount(offer)}
                  </span>
                )}
                {offer !== null && regular !== null && regular > offer && (
                  <s className="font-data text-micro tabular-nums text-text-muted">{amount(regular)}</s>
                )}
                {rate?.varies && <ClockIcon aria-hidden="true" className="size-3 shrink-0 text-text-muted" />}
              </div>
            ),
          };
        }}
      />
      <ul aria-label="Price key" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-micro text-text-secondary">
        <li>First-hour adult rate per hour, in AED</li>
        <li>
          <s className="text-text-muted">Struck through</s>: regular rate
        </li>
        <li className="flex items-center gap-1">
          <ClockIcon aria-hidden="true" className="size-3 shrink-0 text-text-muted" />
          Varies by start time
        </li>
      </ul>
    </div>
  );
}
