import { CONSOLE_LIST } from "@/lib/config/console-list";
import { COUPON_GENERATION, COUPON_OVERVIEW, type CouponRow } from "@/lib/config/coupons";
import { DUBAI_TIME_ZONE, toCalendarDate } from "@/lib/domain/time";

export type CouponsSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export const COUPONS_PATH = "/manage/coupons";

export const COUPON_STATUSES = ["active", "scheduled", "used_up", "expired", "inactive"] as const;

export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const COUPON_STATUS_LABEL: Readonly<Record<CouponStatus, string>> = {
  active: "Active",
  scheduled: "Scheduled",
  used_up: "Used up",
  expired: "Expired",
  inactive: "Inactive",
};

export const COUPON_FILTERS = ["active", "expiring", "scheduled", "used_up", "expired", "inactive"] as const;

export type CouponFilter = (typeof COUPON_FILTERS)[number];

export const COUPON_FILTER_LABEL: Readonly<Record<CouponFilter, string>> = {
  ...COUPON_STATUS_LABEL,
  expiring: "Expiring soon",
};

export const COUPON_KINDS = ["percent", "fixed", "addon_free"] as const satisfies readonly CouponRow["kind"][];

export const COUPON_KIND_LABEL: Readonly<Record<CouponRow["kind"], string>> = {
  percent: "Percentage",
  fixed: "Amount in AED",
  addon_free: "Free add-ons",
};

export interface CouponsQuery {
  readonly search: string;
  readonly status: CouponFilter | null;
  readonly kind: CouponRow["kind"] | null;
  readonly batch: string | null;
  readonly page: number;
}

export interface CouponCalendar {
  readonly today: string;
  readonly soon: string;
}

export interface CouponSummary {
  readonly active: number;
  readonly expiring: number;
  readonly usedUp: number;
  readonly expired: number;
}

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

function positivePage(value: string | string[] | undefined): number {
  const raw = single(value);
  if (raw === undefined || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function batchName(value: string | string[] | undefined): string | null {
  const name = (single(value) ?? "").trim();
  return name === "" || name.length > COUPON_GENERATION.batchNameMax ? null : name;
}

export function parseCouponsQuery(params: CouponsSearchParams): CouponsQuery {
  return {
    search: (single(params.q) ?? "").trim().slice(0, CONSOLE_LIST.searchMaxLength),
    status: oneOf(single(params.status), COUPON_FILTERS),
    kind: oneOf(single(params.kind), COUPON_KINDS),
    batch: batchName(params.batch),
    page: positivePage(params.page),
  };
}

export function couponBatchNames(rows: readonly CouponRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) if (row.batchName !== null && row.batchName !== "") names.add(row.batchName);
  return [...names].sort((left, right) => left.localeCompare(right, "en-GB", { sensitivity: "base", numeric: true }));
}

export function withKnownBatch(query: CouponsQuery, names: readonly string[]): CouponsQuery {
  return query.batch === null || names.includes(query.batch) ? query : { ...query, batch: null };
}

export function isFiltered(query: CouponsQuery): boolean {
  return query.search !== "" || query.status !== null || query.kind !== null || query.batch !== null;
}

export function couponCalendar(today: string): CouponCalendar {
  const { year, month, day } = toCalendarDate(today);
  const soon = new Date(Date.UTC(year, month - 1, day + COUPON_OVERVIEW.expiringSoonDays))
    .toISOString()
    .slice(0, 10);
  return { today, soon };
}

export function couponStatus(row: CouponRow, today: string): CouponStatus {
  if (!row.isActive) return "inactive";
  if (row.validTo && row.validTo < today) return "expired";
  if (row.validFrom && row.validFrom > today) return "scheduled";
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return "used_up";
  return "active";
}

export function isExpiringSoon(row: CouponRow, calendar: CouponCalendar): boolean {
  return (
    couponStatus(row, calendar.today) === "active" &&
    row.validTo !== null &&
    row.validTo <= calendar.soon
  );
}

function matchesStatus(row: CouponRow, status: CouponFilter, calendar: CouponCalendar): boolean {
  if (status === "expiring") return isExpiringSoon(row, calendar);
  return couponStatus(row, calendar.today) === status;
}

export function filterCoupons(
  rows: readonly CouponRow[],
  query: CouponsQuery,
  calendar: CouponCalendar,
): CouponRow[] {
  const term = query.search.toUpperCase();
  return rows.filter(
    (row) =>
      (term === "" || row.code.toUpperCase().includes(term)) &&
      (query.kind === null || row.kind === query.kind) &&
      (query.batch === null || row.batchName === query.batch) &&
      (query.status === null || matchesStatus(row, query.status, calendar)),
  );
}

export function summariseCoupons(rows: readonly CouponRow[], calendar: CouponCalendar): CouponSummary {
  const statuses = rows.map((row) => couponStatus(row, calendar.today));
  return {
    active: statuses.filter((status) => status === "active").length,
    expiring: rows.filter((row) => isExpiringSoon(row, calendar)).length,
    usedUp: statuses.filter((status) => status === "used_up").length,
    expired: statuses.filter((status) => status === "expired").length,
  };
}

export function couponsHref(
  params: CouponsSearchParams,
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
  return query ? `${COUPONS_PATH}?${query}` : COUPONS_PATH;
}

const COUPON_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DUBAI_MIDDAY = "T12:00:00+04:00";

export function couponDay(isoDate: string): string {
  const date = new Date(`${isoDate}${DUBAI_MIDDAY}`);
  return Number.isNaN(date.getTime()) ? isoDate : COUPON_DAY.format(date);
}
