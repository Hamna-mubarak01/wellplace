
export const DUBAI_TIME_ZONE = "Asia/Dubai";

export function formatDubaiDateTime(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("day")} ${get("month")} ${get("year")} at ${get("hour")}:${get("minute")}`;
}

export function formatDubaiTime(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const DUBAI_MIDDAY_SUFFIX = "T12:00:00+04:00";

export function formatCalendarDayLong(isoDate: string): string {
  return formatDubaiDayLong(`${isoDate}${DUBAI_MIDDAY_SUFFIX}`);
}

export function formatDubaiDayLong(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatCountdown(millisecondsRemaining: number): string {
  const total = Math.max(0, Math.ceil(millisecondsRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function todayInDubai(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function toCalendarDate(isoDate: string): CalendarDate {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}

export function isoDatesInMonth(year: number, month: number): string[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return Array.from({ length: days }, (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);
}
