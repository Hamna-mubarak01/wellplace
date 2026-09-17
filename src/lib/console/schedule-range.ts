import { SCHEDULE_PRESENTATION } from "@/lib/config/reception-display";

export interface PeriodRange {
  readonly from: string;
  readonly to: string;
  readonly days: readonly string[];
}

function isoOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function utcDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export const WEEK_STARTS_ON_MONDAY = 1;

export function weekRange(
  isoDate: string,
  weekStartsOn: number = WEEK_STARTS_ON_MONDAY,
): PeriodRange {
  const anchor = utcDay(isoDate);
  const offset = (anchor.getUTCDay() - weekStartsOn + 7) % 7;
  const start = new Date(anchor.getTime() - offset * 86_400_000);

  const days = Array.from({ length: 7 }, (_, index) =>
    isoOf(new Date(start.getTime() + index * 86_400_000)),
  );

  return { from: days[0], to: days[6], days };
}

export function monthRange(
  isoDate: string,
  weekStartsOn: number = WEEK_STARTS_ON_MONDAY,
): PeriodRange {
  const anchor = utcDay(isoDate);
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const lead = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const start = new Date(first.getTime() - lead * 86_400_000);

  const days = Array.from({ length: 42 }, (_, index) =>
    isoOf(new Date(start.getTime() + index * 86_400_000)),
  );

  return { from: days[0], to: days[41], days };
}

export function customRange(from: string, to: string): PeriodRange {
  const first = utcDay(from), last = utcDay(to);
  const count = Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
  const length = Number.isFinite(count) ? Math.max(1, Math.min(SCHEDULE_PRESENTATION.maxRangeDays, count)) : 1;
  const days = Array.from({ length }, (_, index) => isoOf(new Date(first.getTime() + index * 86_400_000)));
  return { from: days[0], to: days[days.length - 1], days };
}

export function isScheduleDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}

export function monthSelection(date: string, endDate?: string) {
  const selected = isScheduleDate(endDate) && endDate > date ? customRange(date, endDate) : null;
  if (!selected) return { selected, calendar: monthRange(date) };
  const from = weekRange(selected.from).from;
  const to = weekRange(selected.to).to;
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const days = Array.from({ length }, (_, index) => isoOf(new Date(Date.parse(from) + index * 86_400_000)));
  return { selected, calendar: { from, to, days } };
}
