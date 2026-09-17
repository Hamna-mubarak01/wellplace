"use client";

import { useMemo } from "react";

import {
  birthYearRange,
  calculateAge as calculateAgeUtc,
  daysInMonth as daysInMonthUtc,
} from "@/lib/domain/age";
import {
  FieldError,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { cn } from "@/lib/utils";

export interface DateOfBirthValue {
  day: number | null;
  month: number | null;
  year: number | null;
}

export const EMPTY_DOB: DateOfBirthValue = { day: null, month: null, year: null };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const OLDEST_BOOKER_AGE = 100;

function daysInMonth(month: number, year: number | null): number {
  return daysInMonthUtc(month, year ?? 2000);
}

export function calculateAge(
  value: DateOfBirthValue,
  today: Date = new Date(),
): number | null {
  const { day, month, year } = value;
  if (day === null || month === null || year === null) return null;
  return calculateAgeUtc({ day, month, year }, today);
}

function getYearRange(
  minAge: number,
  maxAge: number | null,
): { earliest: number; latest: number } {
  return birthYearRange(minAge, maxAge ?? OLDEST_BOOKER_AGE);
}

export interface DobSelectProps {
  id: string;
  label: string;
  minAge: number;
  maxAge: number | null;
  value: DateOfBirthValue;
  onChange: (value: DateOfBirthValue, age: number | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export function DobSelect({
  id,
  label,
  minAge,
  maxAge,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  className,
}: DobSelectProps) {
  const { earliest, latest } = useMemo(
    () => getYearRange(minAge, maxAge),
    [minAge, maxAge],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = latest; y >= earliest; y--) list.push(y);
    return list;
  }, [earliest, latest]);

  const dayCount = value.month ? daysInMonth(value.month, value.year) : 31;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => index + 1),
    [dayCount],
  );

  const age = calculateAge(value);

  function commit(next: DateOfBirthValue) {
    if (next.day !== null && next.month !== null) {
      const maxDay = daysInMonth(next.month, next.year);
      if (next.day > maxDay) next = { ...next, day: null };
    }
    onChange(next, calculateAge(next));
  }

  const errorId = error ? `${id}-error` : undefined;
  const hintId = `${id}-hint`;
  const describedBy = errorId ?? (age !== null ? hintId : undefined);

  return (
    <FieldSet
      aria-required={required || undefined}
      data-invalid={Boolean(error) || undefined}
      className={cn("gap-2", className)}
    >
      <FieldLegend className="mb-0 flex w-full items-baseline justify-between gap-3 text-field-label font-medium text-text-secondary">
        <span>
          {label}
        </span>
        {age !== null && !error && (
          <span
            id={hintId}
            className="font-data text-micro tabular-nums text-text-muted"
          >
            {`${age} years`}
          </span>
        )}
      </FieldLegend>

      <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-3">
        <Select
          value={value.day !== null ? String(value.day) : ""}
          onValueChange={(next) => commit({ ...value, day: Number(next) })}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${id}-day`}
            className="h-control data-[size=default]:h-control rounded-(--radius-card) text-control w-full bg-surface-raised pr-3 pl-4"
            aria-label={`${label} — day`}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={6}
            className="max-h-[min(18rem,var(--radix-select-content-available-height))]"
          >
            {days.map((day) => (
              <SelectItem key={day} value={String(day)} className="text-option">
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.month !== null ? String(value.month) : ""}
          onValueChange={(next) => commit({ ...value, month: Number(next) })}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-control data-[size=default]:h-control rounded-(--radius-card) text-control w-full bg-surface-raised pr-3 pl-4"
            aria-label={`${label} — month`}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={6}
            className="max-h-[min(18rem,var(--radix-select-content-available-height))]"
          >
            {MONTHS.map((month, index) => (
              <SelectItem
                key={month}
                value={String(index + 1)}
                className="text-option"
              >
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={value.year !== null ? String(value.year) : ""}
          onValueChange={(next) => commit({ ...value, year: Number(next) })}
          disabled={disabled}
        >
          <SelectTrigger
            className="h-control data-[size=default]:h-control rounded-(--radius-card) text-control w-full bg-surface-raised pr-3 pl-4"
            aria-label={`${label} — year`}
            aria-describedby={describedBy}
          >
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={6}
            className="max-h-[min(18rem,var(--radix-select-content-available-height))]"
          >
            {years.map((year) => (
              <SelectItem key={year} value={String(year)} className="text-option">
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <FieldError id={errorId} className="text-micro font-medium">
          {error}
        </FieldError>
      )}
    </FieldSet>
  );
}
