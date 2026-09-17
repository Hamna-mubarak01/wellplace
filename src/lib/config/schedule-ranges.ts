import { addDays, format, parseISO } from "date-fns";
import { EMPTY_WEEK, WEEKDAY_KEYS, type WeeklyHours, type SeasonalHours, type OpeningExceptions, type Closures } from "@/lib/config/opening-hours";

export type ScheduleRange = SeasonalHours["periods"][number];

export function nextScheduleDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), "yyyy-MM-dd");
}

export function replaceScheduleRange(periods: readonly ScheduleRange[], next: ScheduleRange): ScheduleRange[] {
  return [...periods.flatMap((period) => {
    if (period.to < next.from || period.from > next.to) return [period];
    const remaining: ScheduleRange[] = [];
    if (period.from < next.from) remaining.push({ ...period, to: nextScheduleDate(next.from, -1) });
    if (period.to > next.to) remaining.push({ ...period, from: nextScheduleDate(next.to, 1) });
    return remaining;
  }), next].sort((a, b) => a.from.localeCompare(b.from));
}

export function unifiedScheduleRanges(seasons: SeasonalHours, dates: OpeningExceptions, closures: Closures): ScheduleRange[] {
  let periods = [...seasons.periods];
  for (const date of dates) periods = replaceScheduleRange(periods, {
    from: date.date, to: date.date,
    hours: Object.fromEntries(WEEKDAY_KEYS.map((day) => [day, date.windows])) as WeeklyHours,
  });
  for (const closure of closures) periods = replaceScheduleRange(periods, { ...closure, hours: structuredClone(EMPTY_WEEK) });
  return periods.sort((a, b) => a.from.localeCompare(b.from));
}
