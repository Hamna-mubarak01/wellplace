import { CONSOLE_LIST } from "@/lib/config/console-list";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { todayInDubai } from "@/lib/domain/time";
import {
  CUSTOMER_FILTERS,
  CUSTOMER_SORTS,
  type CustomerFilter,
  type CustomerSort,
} from "@/lib/db/queries/management-customers";

export type CustomersSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export type NarrowingFilter = Extract<CustomerFilter, "returning" | "upcoming">;

export const CUSTOMERS_PATH = "/manage/customers";
export const LEADS_PATH = "/manage/customers/leads";
export const BLOCKED_PATH = "/manage/customers/blocked";

export const NARROWING_FILTERS: readonly NarrowingFilter[] = CUSTOMER_FILTERS.filter(
  (filter): filter is NarrowingFilter => filter === "returning" || filter === "upcoming",
);

export const FILTER_LABEL: Readonly<Record<NarrowingFilter, string>> = {
  returning: "Returning",
  upcoming: "Upcoming visit",
};

export const SORT_LABEL: Readonly<Record<CustomerSort, string>> = {
  recent: "Most recent",
  name: "Name",
  value: "Highest value",
};

export const DEFAULT_SORT: CustomerSort = "recent";

export const SORT_OPTIONS: readonly CustomerSort[] = CUSTOMER_SORTS;

export const BOOKINGS_PAGE_PARAM = "bookings";

export interface CustomersQuery {
  readonly search: string;
  readonly filter: NarrowingFilter | null;
  readonly sort: CustomerSort;
  readonly page: number;
}

const DUBAI_OFFSET = "+04:00";

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((candidate) => candidate === value) ?? null;
}

export function positivePage(value: string | string[] | undefined): number {
  const raw = single(value);
  if (raw === undefined || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseCustomersQuery(params: CustomersSearchParams): CustomersQuery {
  return {
    search: (single(params.q) ?? "").trim().slice(0, CONSOLE_LIST.searchMaxLength),
    filter: oneOf(single(params.filter), NARROWING_FILTERS),
    sort: oneOf(single(params.sort), SORT_OPTIONS) ?? DEFAULT_SORT,
    page: positivePage(params.page),
  };
}

export function isFiltered(query: CustomersQuery): boolean {
  return query.search !== "" || query.filter !== null;
}

export function customersHref(
  params: CustomersSearchParams,
  patch: Readonly<Record<string, string | null>>,
  path: string = CUSTOMERS_PATH,
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

export function customerHref(id: string): string {
  return `${CUSTOMERS_PATH}/${encodeURIComponent(id)}`;
}

export function customerBookingsHref(id: string, page: number): string {
  const base = customerHref(id);
  return page > 1 ? `${base}?${BOOKINGS_PAGE_PARAM}=${page}#customer-bookings` : `${base}#customer-bookings`;
}

export function shownPage(requested: number, total: number, pageSize: number = MANAGEMENT_LIST.customerBookingsPageSize): number {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  return requested >= 1 && requested <= pageCount ? requested : 1;
}

export function dubaiMonthStart(now: Date): string {
  const [year, month] = todayInDubai(now).split("-");
  return new Date(`${year}-${month}-01T00:00:00${DUBAI_OFFSET}`).toISOString();
}
