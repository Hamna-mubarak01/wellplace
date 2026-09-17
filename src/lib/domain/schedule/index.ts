
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const DUBAI_TIME_ZONE = "Asia/Dubai";

export interface CalendarDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface OpeningWindow {
  readonly opens: string;
  readonly closes: string;
}

function parseHhMm(value: string): { hours: number; minutes: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new RangeError(`Expected a time as HH:MM in 24-hour form, received "${value}".`);
  }
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function dubaiOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return Math.round((asIfUtc - instant.getTime()) / MINUTE_MS);
}

export function dubaiWallTimeToInstant(date: CalendarDate, wallTime: string): Date {
  const { hours, minutes } = parseHhMm(wallTime);
  const naive = Date.UTC(date.year, date.month - 1, date.day, hours, minutes);

  let instant = naive - dubaiOffsetMinutes(new Date(naive)) * MINUTE_MS;
  instant = naive - dubaiOffsetMinutes(new Date(instant)) * MINUTE_MS;

  return new Date(instant);
}

export interface BookableStartsInput {
  readonly date: CalendarDate;
  readonly windows: readonly OpeningWindow[];
  readonly intervalMinutes: number;
  readonly durationHours: number;

  readonly now?: Date;
  readonly maxHorizonDays?: number | null;
  readonly sameDayCutoff?: string | null;
}

export function bookableStarts(input: BookableStartsInput): Date[] {
  const { date, windows, intervalMinutes, durationHours } = input;

  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new RangeError(
      `A start interval must be a positive whole number of minutes, received ${intervalMinutes}.`,
    );
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new RangeError(
      `A booking duration must be a positive number of hours, received ${durationHours}.`,
    );
  }

  const durationMs = durationHours * HOUR_MS;
  const step = intervalMinutes * MINUTE_MS;

  if (input.now) {
    const dayStart = dubaiWallTimeToInstant(date, "00:00").getTime();

    if (input.maxHorizonDays != null) {
      const nowDayStart = startOfDubaiDay(input.now);
      const daysAhead = Math.round((dayStart - nowDayStart) / DAY_MS);
      if (daysAhead > input.maxHorizonDays) return [];
    }

    if (input.sameDayCutoff != null) {
      const nowDayStart = startOfDubaiDay(input.now);
      const isToday = dayStart === nowDayStart;
      if (isToday && input.now.getTime() >= dubaiWallTimeToInstant(date, input.sameDayCutoff).getTime()) {
        return [];
      }
    }
  }

  const earliest = input.now?.getTime() ?? Number.NEGATIVE_INFINITY;

  const found = new Set<number>();

  for (const window of windows) {
    const opens = dubaiWallTimeToInstant(date, window.opens).getTime();
    const closes = openingWindowEnd(date, window).getTime();

    if (window.closes === window.opens) continue;

    for (let start = opens; start + durationMs <= closes; start += step) {
      if (start >= earliest) found.add(start);
    }
  }

  return [...found].sort((a, b) => a - b).map((ms) => new Date(ms));
}

function startOfDubaiDay(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return dubaiWallTimeToInstant(
    { year: get("year"), month: get("month"), day: get("day") },
    "00:00",
  ).getTime();
}

/** The Dubai business day may end after midnight. */
export function openingWindowEnd(date: CalendarDate, window: OpeningWindow): Date {
  const sameDay = dubaiWallTimeToInstant(date, window.closes);
  return window.closes < window.opens ? new Date(sameDay.getTime() + DAY_MS) : sameDay;
}
