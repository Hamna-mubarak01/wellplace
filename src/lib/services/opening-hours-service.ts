import type { z } from "zod";
import { SETTINGS, type SettingsSnapshot } from "@/lib/config";
import { clockLabel } from "@/lib/config/clock-picker";
import { HOURS_EDITOR, LAUNCH_WEEK, WEEKDAY_KEYS, WEEKDAY_LABEL, type HoursSettingKey } from "@/lib/config/opening-hours";
import { resolveOpeningHours, type OpeningSchedule } from "@/lib/domain/opening-hours";
import { dubaiWallTimeToInstant, openingWindowEnd, type CalendarDate } from "@/lib/domain/schedule";
import { formatDubaiTime, todayInDubai, toCalendarDate } from "@/lib/domain/time";

function read<T>(snapshot: SettingsSnapshot, key: HoursSettingKey, schema: z.ZodType<T>): T | null {
  const value = snapshot[key];
  if (value == null) return null;
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Opening hours need review: ${key}. ${result.error.issues.map((issue) => issue.message).join(" ")}`);
  return result.data;
}
export function scheduleFrom(snapshot: SettingsSnapshot): OpeningSchedule {
  return {
    regular: read(snapshot, "hours.regular", SETTINGS["hours.regular"].schema) ?? LAUNCH_WEEK,
    seasonal: read(snapshot, "hours.seasonal", SETTINGS["hours.seasonal"].schema),
    exceptions: read(snapshot, "hours.exceptions", SETTINGS["hours.exceptions"].schema),
    closures: read(snapshot, "hours.closures", SETTINGS["hours.closures"].schema),
  };
}
export function windowsForDate(snapshot: SettingsSnapshot, date: CalendarDate) {
  const iso = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  const schedule = scheduleFrom(snapshot);
  const windows = resolveOpeningHours(schedule, iso);
  const next = new Date(`${iso}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextIso = next.toISOString().slice(0, 10);
  const nextClosed = schedule.closures?.some((entry) => entry.from <= nextIso && entry.to >= nextIso);
  return nextClosed && windows ? windows.map((window) => window.closes < window.opens ? { ...window, closes: "00:00" } : window) : windows;
}

export function openingHoursRefusal(snapshot: SettingsSnapshot, startsAt: string, durationMinutes: number): string | null {
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return "Choose a valid date and duration.";
  const date = toCalendarDate(todayInDubai(start));
  const windows = windowsForDate(snapshot, date);
  if (windows === null) return "Opening hours have not been set for this date.";
  const end = start.getTime() + durationMinutes * 60_000;
  const previousInstant = new Date(start.getTime() - 86_400_000);
  const previousDate = toCalendarDate(todayInDubai(previousInstant));
  const previous = windowsForDate(snapshot, previousDate) ?? [];
  const schedule = scheduleFrom(snapshot);
  const currentIso = todayInDubai(start);
  const endIso = todayInDubai(new Date(end - 1));
  const closedDuringVisit = schedule.closures?.some((closure) => closure.from <= endIso && closure.to >= currentIso);
  if (!closedDuringVisit && [
    ...windows.map((window) => ({ window, date })),
    ...previous.filter((window) => window.closes < window.opens).map((window) => ({ window, date: previousDate })),
  ].some(({ window, date: day }) => start.getTime() >= dubaiWallTimeToInstant(day, window.opens).getTime() && end <= openingWindowEnd(day, window).getTime())) return null;
  if (windows.length === 0) return "WellPlace is closed all day on this date. Choose another day, or add opening hours in Management.";
  const hours = windows.map((window) => `${window.opens}\u2013${window.closes}`).join(", ");
  const stay = `${formatDubaiTime(start)}\u2013${formatDubaiTime(new Date(end))}`;
  return `WellPlace is open ${hours} on this date, and this stay runs ${stay}. Choose a time inside the opening hours, or change them in Management.`;
}

export function publicOpeningHours(snapshot: SettingsSnapshot, now = new Date()) {
  const schedule = scheduleFrom(snapshot);
  const today = todayInDubai(now);
  const days = Array.from({ length: HOURS_EDITOR.publicDays }, (_, index) => {
    const instant = new Date(`${today}T12:00:00Z`);
    instant.setUTCDate(instant.getUTCDate() + index);
    const date = instant.toISOString().slice(0, 10);
    const weekday = WEEKDAY_KEYS[instant.getUTCDay()];
    return { date, label: index === 0 ? "Today" : WEEKDAY_LABEL[weekday], windows: resolveOpeningHours(schedule, date) };
  });
  const special = [
    ...(schedule.seasonal?.periods ?? []).filter((p) => p.to >= today).map((p) => ({
      from: p.from, to: p.to, kind: "Seasonal hours", detail: WEEKDAY_KEYS.map((day) => `${WEEKDAY_LABEL[day]}: ${p.hours[day].map((w) => `${clockLabel(w.opens)} – ${clockLabel(w.closes)}`).join(", ") || "Closed"}`).join(" · "),
    })),
    ...(schedule.exceptions ?? []).filter((p) => p.date >= today).map((p) => ({
      from: p.date, to: p.date, kind: "One-off hours", detail: p.windows.map((w) => `${clockLabel(w.opens)} – ${clockLabel(w.closes)}`).join(", ") || "Closed",
    })),
    ...(schedule.closures ?? []).filter((p) => p.to >= today).map((p) => ({ from: p.from, to: p.to, kind: "Closed", detail: "Closed all day" })),
  ].sort((a, b) => a.from.localeCompare(b.from));
  return { days, special };
}
