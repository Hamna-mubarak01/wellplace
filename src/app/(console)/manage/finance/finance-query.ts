import { CONSOLE_LIST } from "@/lib/config/console-list";
import {
  FINANCE_DEFAULT_PERIOD,
  FINANCE_PERIOD_LABEL,
  FINANCE_PERIODS,
  FINANCE_WEEK_DAYS,
  type FinancePeriod,
} from "@/lib/config/finance";
import type { FinanceSummaryWindows, FinanceWindow } from "@/lib/db/queries/finance-page";
import { dubaiWallTimeToInstant } from "@/lib/domain/schedule";
import { toCalendarDate, todayInDubai } from "@/lib/domain/time";

export type FinanceSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface FinanceListQuery {
  readonly search: string;
  readonly period: FinancePeriod;
  readonly from: string | null;
  readonly to: string | null;
  readonly page: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function isoDate(value: string | undefined): string | null {
  if (value === undefined || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function shiftIsoDate(value: string, days: number): string {
  const { year, month, day } = toCalendarDate(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dubaiDayStart(value: string): string {
  return dubaiWallTimeToInstant(toCalendarDate(value), "00:00").toISOString();
}

export function dayWindow(first: string, last: string): FinanceWindow {
  return { from: dubaiDayStart(first), to: dubaiDayStart(shiftIsoDate(last, 1)) };
}

export function monthWindow(today: string): FinanceWindow {
  const { year, month } = toCalendarDate(today);
  const first = `${today.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { from: dubaiDayStart(first), to: dubaiDayStart(next) };
}

export function periodWindow(period: FinancePeriod, today: string): FinanceWindow | null {
  switch (period) {
    case "today":
      return dayWindow(today, today);
    case "week":
      return dayWindow(shiftIsoDate(today, 1 - FINANCE_WEEK_DAYS), today);
    case "month":
      return monthWindow(today);
    case "all":
      return null;
  }
}

export interface FinanceWindows extends FinanceSummaryWindows {
  readonly todayIso: string;
  readonly monthLabel: string;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

export function financeWindows(now: Date): FinanceWindows {
  const today = todayInDubai(now);
  const { year, month } = toCalendarDate(today);
  return {
    todayIso: today,
    monthLabel: MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1))),
    today: dayWindow(today, today),
    month: monthWindow(today),
  };
}

export function parseFinanceQuery(params: FinanceSearchParams): FinanceListQuery {
  const first = isoDate(single(params.from));
  const second = isoDate(single(params.to)) ?? first;
  const [from, to] = first !== null && second !== null && second < first ? [second, first] : [first, second];
  const rawPage = Number(single(params.page));

  return {
    search: (single(params.q) ?? "").trim().slice(0, CONSOLE_LIST.searchMaxLength),
    period: oneOf(single(params.period), FINANCE_PERIODS) ?? FINANCE_DEFAULT_PERIOD,
    from,
    to: from === null ? null : to,
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function listWindow(query: FinanceListQuery, today: string): FinanceWindow | null {
  if (query.from !== null && query.to !== null) return dayWindow(query.from, query.to);
  return periodWindow(query.period, today);
}

export function isFinanceFiltered(query: FinanceListQuery, selects: readonly (string | null)[] = []): boolean {
  return (
    query.search !== "" ||
    query.from !== null ||
    query.period !== FINANCE_DEFAULT_PERIOD ||
    selects.some((value) => value !== null)
  );
}

export const FINANCE_PERIOD_OPTIONS = FINANCE_PERIODS.map((period) => ({
  value: period,
  label: FINANCE_PERIOD_LABEL[period],
}));

export function financeHref(
  path: string,
  params: FinanceSearchParams,
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
  return query ? `${path}?${query}` : path;
}
