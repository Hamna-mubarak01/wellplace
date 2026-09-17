"use client";

import { todayInDubai } from "@/lib/domain/time";
import { useState } from "react";
import { CalendarDaysIcon } from "lucide-react";
import { ActionError } from "@/components/shared/action-error";
import { NO_SUITE_MESSAGE, NO_START_TIMES_MESSAGE } from "@/lib/domain/action-errors";

import { Button } from "@/components/shared/button";
import { BookingTimePicker } from "@/components/console/reception/booking-time-picker";
import type { TimeSlot } from "@/components/shared/time-tile";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  LABEL_CLASS,
  LEGEND_CLASS,
  dateKeyToDate,
  dateToKey,
  dubaiDayLabel,
  fieldId,
} from "@/components/console/reception/walk-in-form";

export interface WalkInWhenProps {
  maxHorizonDays?: number | null;
  earliestDate?: string;
  date: string;
  onDateChange: (date: string) => void;
  durationsHours: readonly number[];
  durationHours: number;
  onDurationChange: (durationHours: number) => void;
  slots: readonly TimeSlot[];
  startsAt: string | null;
  onStartsAtChange: (startsAt: string | null) => void;
  loading: boolean;
  slotsError: string | null;
  onRetrySlots?: () => void;
  disabled: boolean;
  error?: string;
}

function StartTime({
  slots,
  startsAt,
  onStartsAtChange,
  loading,
  slotsError,
  onRetrySlots,
  durationHours,
  disabled,
}: Pick<
  WalkInWhenProps,
  | "slots"
  | "startsAt"
  | "onStartsAtChange"
  | "loading"
  | "slotsError"
  | "onRetrySlots"
  | "durationHours"
  | "disabled"
>) {
  if (loading) {
    return (
      <p role="status" className="py-3 text-console-body text-text-secondary">Checking available times…</p>
    );
  }

  if (slotsError) {
    return (
      <ActionError title="No start times to show" message={slotsError}>
          {onRetrySlots ? (
            <Button
              hoverEffect="sweep"
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetrySlots}
              className="mt-2"
            >
              Try again
            </Button>
          ) : null}
      </ActionError>
    );
  }

  if (slots.length === 0) {
    return (
      <ActionError title={`No start time fits a ${durationHours}-hour visit`} message={NO_START_TIMES_MESSAGE} />
    );
  }

  const bookable = slots.filter((slot) => !slot.tile.disabled).length;

  return (
    <>
      {bookable === 0 && (
        <ActionError title={`No suite is available for a ${durationHours}-hour visit`} message={NO_SUITE_MESSAGE} />
      )}
      <BookingTimePicker
        slots={slots}
        value={startsAt}
        onChange={onStartsAtChange}
        disabled={disabled}
      />
    </>
  );
}

export function WalkInWhen({
  maxHorizonDays,
  earliestDate,
  date,
  onDateChange,
  durationsHours,
  durationHours,
  onDurationChange,
  slots,
  startsAt,
  onStartsAtChange,
  loading,
  slotsError,
  onRetrySlots,
  disabled,
  error,
}: WalkInWhenProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const firstDate = dateKeyToDate(earliestDate ?? todayInDubai());
  const lastDate = new Date(firstDate);
  if (maxHorizonDays != null) lastDate.setDate(lastDate.getDate() + maxHorizonDays);
  const errorId = error ? fieldId("times-error") : undefined;

  return (
    <FieldSet className="gap-3" data-invalid={Boolean(error) || undefined}>
      <FieldLegend className={LEGEND_CLASS}>Visit date and time</FieldLegend>
      {error && <p id={errorId} className="sr-only">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>Date</span>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                hoverEffect="simple"
                type="button"
                id={fieldId("date")}
                variant="outline"
                disabled={disabled}
                className="h-tap w-full justify-between px-3 text-console-body font-normal"
              >
                <span className="truncate font-data tabular-nums">
                  {dubaiDayLabel(date)}
                </span>
                <CalendarDaysIcon aria-hidden="true" className="size-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                disabled={maxHorizonDays == null ? { before: firstDate } : [{ before: firstDate }, { after: lastDate }]}
                required
                showOutsideDays={false}
                selected={dateKeyToDate(date)}
                defaultMonth={dateKeyToDate(date)}
                onSelect={(next: Date) => {
                  onDateChange(dateToKey(next));
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col gap-2">
          <span className={LABEL_CLASS} id={fieldId("duration-label")}>
            Session length
          </span>
          <ToggleGroup
            type="single"
            id={fieldId("duration")}
            aria-labelledby={fieldId("duration-label")}
            value={String(durationHours)}
            disabled={disabled}
            onValueChange={(next) => {
              if (next !== "") onDurationChange(Number(next));
            }}
            className="flex w-full flex-wrap justify-start gap-2 rounded-none"
          >
            {durationsHours.map((hours) => (
              <ToggleGroupItem
                key={hours}
                value={String(hours)}
                aria-label={`${hours} hours`}
                className="h-tap min-w-tap flex-none cursor-pointer rounded-(--radius-card) border border-border bg-surface-raised px-3 text-console-body text-text-primary transition-colors duration-150 hover:border-brand hover:bg-surface-hover data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:font-medium data-[state=on]:text-brand"
              >
                <span className="font-data tabular-nums">{hours}</span>
                <span>h</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <Field
        data-invalid={Boolean(error) || undefined}
        id={fieldId("times")}
        tabIndex={-1}
        aria-describedby={errorId}
        className="flex flex-col gap-2"
      >
        <FieldLabel htmlFor="walk-in-start-time" className={LABEL_CLASS}>Start time</FieldLabel>
        <StartTime
          slots={slots}
          startsAt={startsAt}
          onStartsAtChange={onStartsAtChange}
          loading={loading}
          slotsError={slotsError}
          onRetrySlots={onRetrySlots}
          durationHours={durationHours}
          disabled={disabled}
        />
      </Field>

    </FieldSet>
  );
}
