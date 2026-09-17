import type { BookingDetail } from "@/lib/db/queries/bookings";
import type { Database } from "@/types/database.generated";

export type SuiteStatus = Database["public"]["Enums"]["suite_status"];

export const BOARD_STATES = [
  "hold",
  "booked",
  "checked_in",
  "cleaning",
  "block",
  "maintenance",
  "no_show",
  "completed",
] as const;

export type BoardState = (typeof BOARD_STATES)[number];

export const BOARD_STATE_LABEL: Readonly<Record<BoardState, string>> = {
  hold: "Held",
  booked: "Booked",
  checked_in: "Checked in",
  cleaning: "Cleaning",
  block: "Blocked",
  maintenance: "Maintenance",
  no_show: "No show",
  completed: "Completed",
};

export type BoardTone =
  "brand" | "success" | "warning" | "danger" | "info" | "muted";

export const BOARD_STATE_TONE: Readonly<Record<BoardState, BoardTone>> = {
  hold: "warning",
  booked: "brand",
  checked_in: "success",
  cleaning: "info",
  block: "danger",
  maintenance: "warning",
  no_show: "danger",
  completed: "muted",
};

export interface BoardSuite {
  readonly id: string;
  readonly suiteNumber: number;
  readonly status: SuiteStatus;
  readonly internalNote: string | null;
}

export interface BoardEntry {
  readonly id: string;
  readonly suiteId: string;
  readonly bookingId: string | null;
  readonly bookingReference: string | null;
  readonly guestName: string | null;
  readonly guestEmail?: string | null;
  readonly guestPhone?: string | null;
  readonly adults?: number;
  readonly children?: number;
  readonly detailsUnavailable?: boolean;
  readonly paymentStatus?: Database["public"]["Enums"]["payment_status"] | null;
  readonly detail?: Pick<
    BookingDetail,
    | "guestEmail"
    | "guestPhone"
    | "adults"
    | "children"
    | "totalFils"
    | "source"
    | "addons"
    | "personalRequest"
    | "internalNote"
    | "warningNote"
    | "guests"
    | "isComplimentary"
  >;
  readonly state: BoardState;
  readonly experienceStart: string;
  readonly experienceEnd: string;
  readonly blockedEnd: string;
  readonly holdExpiresAt: string | null;
  readonly reason: string | null;
}

export interface BoardWindow {
  readonly start: string;
  readonly end: string;
}

export interface BoardData {
  readonly window: BoardWindow;
  readonly openingWindow?: BoardWindow | null;
  readonly suites: readonly BoardSuite[];
  readonly entries: readonly BoardEntry[];
}

export interface BoardPlacement {
  readonly leftPercent: number;
  readonly widthPercent: number;
  readonly bufferPercent: number;
}

export const UNRELEASED_SUITE_STATUSES: readonly SuiteStatus[] = [
  "cleaning",
  "not_ready",
];

export function isSuiteUnreleased(
  suite: Pick<BoardSuite, "status"> | undefined,
): boolean {
  return (
    suite !== undefined && UNRELEASED_SUITE_STATUSES.includes(suite.status)
  );
}

export function isCleaningOverdue(
  entry: BoardEntry,
  suite: Pick<BoardSuite, "status"> | undefined,
  now: number = Date.now(),
): boolean {
  if (!isSuiteUnreleased(suite) || !entry.bookingId || entry.state === "hold")
    return false;
  const blockedEnd = Date.parse(entry.blockedEnd);
  return Number.isFinite(blockedEnd) && blockedEnd <= now;
}

const CLEANS_AFTER: readonly BoardState[] = ["booked", "checked_in", "completed", "cleaning"];

export function liveSuiteStatus(
  suite: BoardSuite,
  entries: readonly BoardEntry[],
  now: number | null,
): SuiteStatus {
  if (now === null || suite.status !== "available") return suite.status;
  const cleaning = entries.some(
    (entry) =>
      entry.suiteId === suite.id &&
      entry.bookingId !== null &&
      CLEANS_AFTER.includes(entry.state) &&
      Date.parse(entry.experienceEnd) <= now &&
      now < Date.parse(entry.blockedEnd),
  );
  return cleaning ? "cleaning" : suite.status;
}

export function overdueBufferForSuite(
  entries: readonly BoardEntry[],
  suite: BoardSuite,
  now: number = Date.now(),
): BoardEntry | undefined {
  const latest = entriesForSuite(entries, suite.id).findLast(
    (entry) =>
      entry.bookingId !== null &&
      entry.state !== "hold" &&
      Date.parse(entry.experienceStart) <= now,
  );
  return latest && isCleaningOverdue(latest, suite, now) ? latest : undefined;
}

export function overdueCleaningMinutes(
  entry: BoardEntry,
  now: number = Date.now(),
): number {
  const blockedEnd = Date.parse(entry.blockedEnd);
  return Number.isFinite(blockedEnd)
    ? Math.max(0, Math.floor((now - blockedEnd) / 60_000))
    : 0;
}

export function placeEntry(
  entry: BoardEntry,
  window: BoardWindow,
): BoardPlacement | null {
  const windowStart = Date.parse(window.start);
  const windowEnd = Date.parse(window.end);
  const span = windowEnd - windowStart;
  if (!Number.isFinite(span) || span <= 0) return null;

  const start = Date.parse(entry.experienceStart);
  const end = Date.parse(entry.experienceEnd);
  const blockedEnd = Date.parse(entry.blockedEnd);

  const visibleStart = Math.max(start, windowStart);
  const visibleEnd = Math.min(Math.max(end, visibleStart), windowEnd);
  const visibleBlockedEnd = Math.min(
    Math.max(blockedEnd, visibleEnd),
    windowEnd,
  );

  if (visibleEnd <= windowStart || visibleStart >= windowEnd) return null;

  const toPercent = (value: number) => ((value - windowStart) / span) * 100;

  const leftPercent = toPercent(visibleStart);
  const widthPercent = Math.max(toPercent(visibleEnd) - leftPercent, 0);
  const bufferPercent = Math.max(
    toPercent(visibleBlockedEnd) - toPercent(visibleEnd),
    0,
  );

  return { leftPercent, widthPercent, bufferPercent };
}

export function axisMarks(
  window: BoardWindow,
  stepMinutes: number,
): readonly string[] {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const step = Math.max(1, Math.round(stepMinutes)) * 60 * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return [];

  const marks: string[] = [];
  const first = Math.ceil(start / step) * step;

  for (let instant = first; instant <= end; instant += step) {
    marks.push(new Date(instant).toISOString());
  }

  return marks;
}

const MINUTES_PER_HOUR = 60;

export function hourMarks(window: BoardWindow): readonly string[] {
  return axisMarks(window, MINUTES_PER_HOUR);
}

export function offsetPercent(
  instant: string | number,
  window: BoardWindow,
): number | null {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const span = end - start;
  if (!Number.isFinite(span) || span <= 0) return null;

  const at = typeof instant === "number" ? instant : Date.parse(instant);
  if (!Number.isFinite(at)) return null;

  return ((at - start) / span) * 100;
}

export function entriesForSuite(
  entries: readonly BoardEntry[],
  suiteId: string,
): readonly BoardEntry[] {
  return entries
    .filter((entry) => entry.suiteId === suiteId)
    .toSorted((a, b) => a.experienceStart.localeCompare(b.experienceStart));
}
