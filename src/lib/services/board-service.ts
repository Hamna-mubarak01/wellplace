import type { PeriodRange } from "@/lib/console/schedule-range";
export { weekRange, monthRange, customRange, monthSelection, WEEK_STARTS_ON_MONDAY, type PeriodRange } from "@/lib/console/schedule-range";
import type { SettingsSnapshot } from "@/lib/config";
import type { WellPlaceClient } from "@/lib/db/types";
import { listOccupancy, listSuites, type OccupancyRow } from "@/lib/db/queries/board";
import { windowsForDate } from "@/lib/services/availability-service";
import { dubaiWallTimeToInstant, openingWindowEnd, type CalendarDate } from "@/lib/domain/schedule";
import { todayInDubai } from "@/lib/domain/time";
import type {
  BoardData,
  BoardEntry,
  BoardState,
  BoardWindow,
} from "@/components/console/reception/board-types";

export function stateFor(row: OccupancyRow): BoardState {
  return row.boardState;
}

export type BoardDayStatus = "open" | "closed" | "hours_unconfigured";

export interface BoardDay {
  readonly status: BoardDayStatus;
  readonly window: BoardWindow | null;
}

export function dayWindow(
  snapshot: SettingsSnapshot,
  date: CalendarDate,
): BoardDay {
  const windows = windowsForDate(snapshot, date);
  if (windows === null) return { status: "hours_unconfigured", window: null };
  if (windows.length === 0) return { status: "closed", window: null };

  const opens = windows.reduce(
    (earliest, current) => (current.opens < earliest ? current.opens : earliest),
    windows[0].opens,
  );
  const closes = Math.max(...windows.map((window) => openingWindowEnd(date, window).getTime()));

  return {
    status: "open",
    window: {
      start: dubaiWallTimeToInstant(date, opens).toISOString(),
      end: new Date(closes).toISOString(),
    },
  };
}

export async function getBoard(
  client: WellPlaceClient,
  window: BoardWindow,
): Promise<BoardData> {
  const [listing, occupancy] = await Promise.all([
    listSuites(client),
    listOccupancy(client, { from: window.start, to: window.end }),
  ]);

  if (!listing.ok) {
    throw new Error(
      `The suites could not be read, so the board cannot be drawn: ${listing.message}`,
    );
  }

  const entries: BoardEntry[] = occupancy.map((row) => ({
    id: row.id,
    suiteId: row.suiteId,
    bookingId: row.bookingId,
    bookingReference: row.bookingReference,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    adults: row.adults,
    children: row.children,
    detailsUnavailable: row.detailsUnavailable,
    paymentStatus: row.paymentStatus,
    state: stateFor(row),
    experienceStart: row.experienceStart,
    experienceEnd: row.experienceEnd,
    blockedEnd: row.blockedEnd,
    holdExpiresAt: row.expiresAt,
    reason: row.reason,
  }));

  return {
    window,
    suites: listing.suites.map((suite) => ({
      id: suite.id,
      suiteNumber: suite.suiteNumber,
      status: suite.status,
      internalNote: suite.internalNote,
    })),
    entries,
  };
}

function isoOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function utcDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export async function getPeriodBoard(
  client: WellPlaceClient,
  _snapshot: SettingsSnapshot,
  range: PeriodRange,
): Promise<{ suites: BoardData["suites"]; byDay: Map<string, BoardEntry[]> }> {
  const from = dubaiWallTimeToInstant(toCalendar(range.from), "00:00").toISOString();
  const endDay = new Date(`${range.to}T00:00:00Z`);
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const to = dubaiWallTimeToInstant(toCalendar(isoOf(endDay)), "00:00").toISOString();
  const board = await getBoard(client, { start: from, end: to });
  const byDay = new Map<string, BoardEntry[]>();
  for (const day of range.days) {
    const start = Date.parse(dubaiWallTimeToInstant(toCalendar(day), "00:00").toISOString());
    const end = start + 86_400_000;
    byDay.set(day, board.entries.filter((entry) => Date.parse(entry.experienceStart) < end && Date.parse(entry.blockedEnd) > start));
  }

  return { suites: board.suites, byDay };
}

function toCalendar(isoDate: string): CalendarDate {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}


export function operatingDayInDubai(snapshot: SettingsSnapshot, now: Date = new Date()): string {
  const today = todayInDubai(now);
  const previous = isoOf(new Date(utcDay(today).getTime() - 86_400_000));
  const window = dayWindow(snapshot, toCalendar(previous)).window;
  return window !== null && now.getTime() < Date.parse(window.end) ? previous : today;
}

export function businessDayWindow(snapshot: SettingsSnapshot, date: string): BoardWindow {
  const calendar = fullDayWindow(date);
  const opening = dayWindow(snapshot, toCalendar(date)).window;
  if (opening === null) return calendar;
  return {
    start: Date.parse(opening.start) < Date.parse(calendar.start) ? opening.start : calendar.start,
    end: Date.parse(opening.end) > Date.parse(calendar.end) ? opening.end : calendar.end,
  };
}

export function fullDayWindow(date: string): BoardWindow {
  const first = utcDay(date), next = new Date(first.getTime() + 86_400_000);
  return { start: dubaiWallTimeToInstant(toCalendar(isoOf(first)), "00:00").toISOString(), end: dubaiWallTimeToInstant(toCalendar(isoOf(next)), "00:00").toISOString() };
}
