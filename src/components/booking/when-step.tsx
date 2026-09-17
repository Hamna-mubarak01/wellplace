"use client";

import { BookingCalendar } from "@/components/booking/booking-calendar";
import type {
  AlternativeDate,
  BookingDay,
  DayStatus,
} from "@/components/booking/booking-types";
import { DurationChips } from "@/components/booking/duration-chips";
import { NoTimes } from "@/components/booking/no-times";
import { TimeDialog } from "@/components/booking/time-dialog";
import type { TimeSlot } from "@/components/shared/time-tile";


export interface WhenStepProps {
  days: readonly BookingDay[];
  dateKey: string;
  onDateChange: (dateKey: string) => void;

  durationsHours: readonly number[];
  durationHours: number;
  onDurationChange: (durationHours: number) => void;

  slots: readonly TimeSlot[];
  dayStatus: DayStatus;
  dayLabel: string;
  alternativeDurations: readonly number[];
  alternativeDates: readonly AlternativeDate[];

  startsAt: string | null;
  onStartsAtChange: (startsAt: string | null) => void;
  onHoldExpire?: (startsAt: string) => void;

  timesOpen: boolean;
  onTimesOpenChange: (open: boolean) => void;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function WhenStep({
  days,
  dateKey,
  onDateChange,
  durationsHours,
  durationHours,
  onDurationChange,
  slots,
  dayStatus,
  dayLabel,
  alternativeDurations,
  alternativeDates,
  startsAt,
  onStartsAtChange,
  onHoldExpire,
  timesOpen,
  onTimesOpenChange,
  loading = false,
  error = null,
  onRetry,
}: WhenStepProps) {
  const settled = !loading && error === null;
  const dayHasNothing = settled && slots.length === 0;

  return (
    <div className="w-full">
      <DurationChips
        durationsHours={durationsHours}
        value={durationHours}
        onValueChange={onDurationChange}
      />

      <div className="mt-5 border-t border-border pt-5 lg:mt-8 lg:pt-8">
        <h2 className="sr-only">Choose a date</h2>
        <BookingCalendar days={days} value={dateKey} onValueChange={onDateChange} />

        {dayHasNothing ? (
          <div className="mt-4 border-t border-border pt-4 lg:mt-6 lg:pt-6">
            <NoTimes
              dayStatus={dayStatus}
              durationHours={durationHours}
              alternativeDurations={alternativeDurations}
              onDurationChange={onDurationChange}
              alternativeDates={alternativeDates}
              onDateChange={onDateChange}
            />
          </div>
        ) : null}
      </div>

      <TimeDialog
        open={timesOpen}
        onOpenChange={onTimesOpenChange}
        dayLabel={dayLabel}
        dateKey={dateKey}
        dayStatus={dayStatus}
        durationHours={durationHours}
        slots={slots}
        value={startsAt}
        onValueChange={onStartsAtChange}
        onHoldExpire={onHoldExpire}
        alternativeDurations={alternativeDurations}
        onDurationChange={onDurationChange}
        alternativeDates={alternativeDates}
        onDateChange={onDateChange}
        loading={loading}
        error={error}
        onRetry={onRetry}
      />
    </div>
  );
}
