import { SHOWN_BOOKING_STATUSES, type BookingStatus } from "@/lib/domain/booking";
import {
  BOOKED_MONTH_PARAM,
  RATES_MONTH_PARAM,
  SUITE_PARAM,
  type SuitesSearchParams,
} from "@/app/(console)/manage/suites/suites-view";

export const SUITE_TABS = ["overview", "bookings", "pricing"] as const;
export type SuiteTab = (typeof SUITE_TABS)[number];

export const DEFAULT_SUITE_TAB: SuiteTab = "overview";

export const SUITE_TAB_LABEL: Readonly<Record<SuiteTab, string>> = {
  overview: "Overview",
  bookings: "Bookings",
  pricing: "Pricing",
};

export const SUITE_BOOKING_STATUSES: readonly BookingStatus[] = SHOWN_BOOKING_STATUSES.filter(
  (status) => status !== "abandoned",
);

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const EARLIEST_YEAR = 2000;
const LATEST_YEAR = 2100;
const MONTHS_PER_YEAR = 12;

export interface SuiteDrawerQuery {
  readonly suiteId: string | null;
  readonly bookedMonth: string;
  readonly rateMonth: string;
}

export interface SuiteBookingGroups<Row> {
  readonly upcoming: readonly Row[];
  readonly earlier: readonly Row[];
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isMonth(value: string | undefined): value is string {
  if (value === undefined) return false;
  const match = MONTH.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  return year >= EARLIEST_YEAR && year <= LATEST_YEAR;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function parseSuiteTab(value: string | null | undefined): SuiteTab {
  return SUITE_TABS.find((tab) => tab === value) ?? DEFAULT_SUITE_TAB;
}

export function tabParam(tab: SuiteTab): string | null {
  return tab === DEFAULT_SUITE_TAB ? null : tab;
}

export function parseSuiteDrawerQuery(params: SuitesSearchParams, today: string): SuiteDrawerQuery {
  const suite = single(params[SUITE_PARAM])?.trim() ?? "";
  const booked = single(params[BOOKED_MONTH_PARAM]);
  const rates = single(params[RATES_MONTH_PARAM]);

  return {
    suiteId: suite === "" ? null : suite,
    bookedMonth: isMonth(booked) ? booked : monthOf(today),
    rateMonth: isMonth(rates) ? rates : monthOf(today),
  };
}

export function monthParts(month: string): { year: number; month: number } {
  const [year, index] = month.split("-").map(Number);
  return { year, month: index };
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: index } = monthParts(month);
  const total = year * MONTHS_PER_YEAR + (index - 1) + delta;
  const nextYear = Math.floor(total / MONTHS_PER_YEAR);
  const nextMonth = (total % MONTHS_PER_YEAR) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

export function monthLabel(month: string): string {
  const { year, month: index } = monthParts(month);
  return MONTH_LABEL.format(new Date(Date.UTC(year, index - 1, 15)));
}

export function splitSuiteBookings<Row extends { readonly id: string }>(
  upcoming: readonly Row[],
  earlier: readonly Row[],
  limit: number,
): SuiteBookingGroups<Row> {
  const budget = Math.max(0, Math.trunc(limit));
  const soon = upcoming.slice(0, budget);
  const shown = new Set(soon.map((row) => row.id));
  const before = earlier.filter((row) => !shown.has(row.id)).slice(0, budget - soon.length);
  return { upcoming: soon, earlier: before };
}
