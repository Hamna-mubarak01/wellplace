import type {
  BookingSource,
  BookingStatus,
  ManagementBookingQuery,
} from "@/lib/db/queries/management-bookings";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { SHOWN_BOOKING_STATUSES } from "@/lib/domain/booking";
import { dubaiWallTimeToInstant } from "@/lib/domain/schedule";
import { DUBAI_TIME_ZONE, toCalendarDate, todayInDubai } from "@/lib/domain/time";

export const BOOKINGS_PATH = "/manage/bookings";

export type BookingsSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export const BOOKING_PERIODS = ["today", "upcoming", "past", "all"] as const;
export type BookingPeriod = (typeof BOOKING_PERIODS)[number];

export const PERIOD_LABEL: Readonly<Record<BookingPeriod, string>> = {
  today: "Today",
  upcoming: "Upcoming",
  past: "Past",
  all: "All",
};

export const STATUS_GROUPS = {
  attention: ["awaiting_payment", "payment_failed", "awaiting_recovery"],
  visits: ["confirmed", "checked_in", "completed"],
} as const satisfies Readonly<Record<string, readonly BookingStatus[]>>;

export type StatusGroup = keyof typeof STATUS_GROUPS;
export type StatusFilter = BookingStatus | StatusGroup;

export const STATUS_GROUP_LABEL: Readonly<Record<StatusGroup, string>> = {
  attention: "Needs attention",
  visits: "Confirmed visits",
};

const GROUP_KEYS: readonly StatusGroup[] = ["attention", "visits"];

export const SOURCE_GROUPS = {
  reception: ["walk_in", "telephone", "manual", "complimentary"],
} as const satisfies Readonly<Record<string, readonly BookingSource[]>>;

export type SourceGroup = keyof typeof SOURCE_GROUPS;
export type SourceFilter = BookingSource | SourceGroup;

export const SOURCE_FILTERS: readonly SourceFilter[] = [
  "online",
  "reception",
  "walk_in",
  "telephone",
  "manual",
  "complimentary",
];

export const SOURCE_FILTER_LABEL: Readonly<Record<SourceFilter, string>> = {
  online: "Website",
  reception: "All reception bookings",
  walk_in: "Walk-in",
  telephone: "Telephone",
  manual: "Manual",
  complimentary: "Complimentary",
};

export type SortDirection = "asc" | "desc";
const DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

export const VISIT_SORT = "visit";

export const BOOKING_SORTS = ["visit", "created"] as const;
export type BookingSort = (typeof BOOKING_SORTS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export interface BookingsQuery {
  readonly search: string;
  readonly status: StatusFilter | null;
  readonly source: SourceFilter | null;
  readonly suiteId: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly period: BookingPeriod;
  readonly sort: BookingSort;
  readonly direction: SortDirection | null;
  readonly page: number;
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function isoDate(value: string | undefined): string | null {
  if (value === undefined || !ISO_DATE.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dubaiDayStart(date: string): string {
  return dubaiWallTimeToInstant(toCalendarDate(date), "00:00").toISOString();
}

export function parseBookingsQuery(
  params: BookingsSearchParams,
  suiteIds: readonly string[],
): BookingsQuery {
  const first = isoDate(single(params.from));
  const second = isoDate(single(params.to)) ?? first;
  const [from, to] =
    first !== null && second !== null && second < first ? [second, first] : [first, second];
  const rawPage = Number(single(params.page));
  const suite = single(params.suite);
  const period = from === null ? (oneOf(single(params.period), BOOKING_PERIODS) ?? "all") : "all";
  const sort = oneOf(single(params.sort), BOOKING_SORTS) ?? (period === "all" && from === null ? "created" : "visit");

  return {
    search: (single(params.q) ?? "").trim().slice(0, CONSOLE_LIST.searchMaxLength),
    status: oneOf(single(params.status), [...GROUP_KEYS, ...SHOWN_BOOKING_STATUSES]),
    source: oneOf(single(params.source), SOURCE_FILTERS),
    suiteId: suite !== undefined && suiteIds.includes(suite) ? suite : null,
    from,
    to: from === null ? null : to,
    period,
    sort,
    direction: oneOf(single(params.dir), DIRECTIONS),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function defaultDirection(period: BookingPeriod): SortDirection {
  return period === "today" || period === "upcoming" ? "asc" : "desc";
}

export function sortDirection(query: BookingsQuery): SortDirection {
  if (query.direction !== null) return query.direction;
  return query.sort === "created" ? "desc" : defaultDirection(query.period);
}

export function statusesFor(filter: StatusFilter | null): readonly BookingStatus[] | undefined {
  if (filter === null) return undefined;
  if (filter === "attention" || filter === "visits") return STATUS_GROUPS[filter];
  return [filter];
}

export function visitWindow(query: BookingsQuery, now: Date): { from?: string; to?: string } {
  if (query.from !== null && query.to !== null) {
    return { from: dubaiDayStart(query.from), to: dubaiDayStart(addDays(query.to, 1)) };
  }

  const today = todayInDubai(now);
  switch (query.period) {
    case "today":
      return { from: dubaiDayStart(today), to: dubaiDayStart(addDays(today, 1)) };
    case "upcoming":
      return { from: now.toISOString() };
    case "past":
      return { to: dubaiDayStart(today) };
    case "all":
      return {};
  }
}

export function sourcesFor(query: BookingsQuery): readonly BookingSource[] | undefined {
  if (query.source === null) return undefined;
  return query.source === "reception" ? SOURCE_GROUPS.reception : [query.source];
}

export function listRequest(
  query: BookingsQuery,
  now: Date,
  pageSize: number = MANAGEMENT_LIST.pageSize,
): ManagementBookingQuery {
  const statuses = statusesFor(query.status);
  const sources = sourcesFor(query);
  return {
    page: query.page,
    pageSize,
    ...(query.search === "" ? {} : { search: query.search }),
    ...(statuses === undefined ? {} : { statuses }),
    ...(sources === undefined ? {} : { sources }),
    ...(query.suiteId === null ? {} : { suiteId: query.suiteId }),
    ...visitWindow(query, now),
    orderBy: query.sort,
    oldestFirst: sortDirection(query) === "asc",
  };
}

export function isFiltered(query: BookingsQuery): boolean {
  return (
    query.search !== "" ||
    query.status !== null ||
    query.source !== null ||
    query.suiteId !== null ||
    query.from !== null ||
    query.period !== "all"
  );
}

export function bookingsHref(
  params: BookingsSearchParams,
  patch: Readonly<Record<string, string | null>>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const current = single(value);
    if (current !== undefined && current !== "") next.set(key, current);
  }
  if (!("page" in patch)) next.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${BOOKINGS_PATH}?${query}` : BOOKINGS_PATH;
}

export function filtersHref(filters: Readonly<Record<string, string>>): string {
  const query = new URLSearchParams(filters).toString();
  return query ? `${BOOKINGS_PATH}?${query}` : BOOKINGS_PATH;
}

export function exportHref(params: BookingsSearchParams): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const current = single(value);
    if (current !== undefined && current !== "" && key !== "page") next.set(key, current);
  }
  const query = next.toString();
  return query ? `/api/console/bookings/export?${query}` : "/api/console/bookings/export";
}

export function monthBounds(now: Date): { first: string; last: string; label: string } {
  const today = todayInDubai(now);
  const [year, month] = today.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = today.slice(0, 8);
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: DUBAI_TIME_ZONE, month: "long" }).format(now);
  return { first: `${prefix}01`, last: `${prefix}${String(days).padStart(2, "0")}`, label };
}

export type SummaryKey = "today" | "upcoming" | "inSuite" | "attention" | "cancelled";

export const SUMMARY_KEYS: readonly SummaryKey[] = ["today", "upcoming", "inSuite", "attention", "cancelled"];

export function summaryFilters(now: Date): Readonly<Record<SummaryKey, Readonly<Record<string, string>>>> {
  const month = monthBounds(now);
  return {
    today: { period: "today", status: "visits" },
    upcoming: { period: "upcoming", status: "confirmed" },
    inSuite: { status: "checked_in" },
    attention: { status: "attention" },
    cancelled: { status: "cancelled", from: month.first, to: month.last },
  };
}

export function summaryRequest(
  filters: Readonly<Record<string, string>>,
  suiteIds: readonly string[],
  now: Date,
): ManagementBookingQuery {
  return listRequest(parseBookingsQuery(filters, suiteIds), now, 1);
}

export function matchesFilters(
  query: BookingsQuery,
  filters: Readonly<Record<string, string>>,
  suiteIds: readonly string[],
): boolean {
  const card = parseBookingsQuery(filters, suiteIds);
  return (
    query.search === card.search &&
    query.status === card.status &&
    query.source === card.source &&
    query.suiteId === card.suiteId &&
    query.from === card.from &&
    query.to === card.to &&
    query.period === card.period
  );
}
