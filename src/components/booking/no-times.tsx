"use client";

import type { AlternativeDate, DayStatus } from "@/components/booking/booking-types";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";


export interface NoTimesProps {
  dayStatus: DayStatus;
  durationHours: number;
  alternativeDurations: readonly number[];
  onDurationChange: (durationHours: number) => void;
  alternativeDates: readonly AlternativeDate[];
  onDateChange: (dateKey: string) => void;
  className?: string;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-small text-pretty text-text-secondary">{children}</p>;
}

const OPTION_CLASS =
  "h-auto min-h-tap w-full justify-start rounded-(--radius-card) border-border bg-surface-raised px-4 py-2.5 text-control font-medium whitespace-normal text-text-primary hover:border-brand hover:bg-surface-hover";

export function NoTimes({
  dayStatus,
  durationHours,
  alternativeDurations,
  onDurationChange,
  alternativeDates,
  onDateChange,
  className,
}: NoTimesProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {dayStatus === "hours-unpublished" ? (
        <Note>
          Opening hours for this date are not published yet. Pick a nearer date
          to see start times.
        </Note>
      ) : dayStatus === "closed" ? (
        <Note>WellPlace is closed on this date.</Note>
      ) : (
        <Note>
          No {durationHours}-hour session fits into this date.
          {alternativeDurations.length > 0
            ? " A different length still does."
            : null}
        </Note>
      )}

      {dayStatus === "open" && alternativeDurations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {alternativeDurations.map((hours) => (
            <Button
              key={hours}
              type="button"
              variant="outline"
              onClick={() => onDurationChange(hours)}
              className="h-control rounded-(--radius-card) border-border bg-surface-raised px-4 text-control text-text-primary hover:border-brand hover:bg-surface-hover"
            >
              Try {hours} hours
            </Button>
          ))}
        </div>
      ) : null}

      {alternativeDates.length > 0 ? (
        <div className="mt-5">
          <p className="text-label font-medium tracking-label text-text-muted uppercase">
            Next available
          </p>
          <div className="mt-2.5 flex flex-col gap-2">
            {alternativeDates.map((date) => (
              <Button
                key={date.date}
                type="button"
                variant="outline"
                onClick={() => onDateChange(date.date)}
                className={OPTION_CLASS}
              >
                {date.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
