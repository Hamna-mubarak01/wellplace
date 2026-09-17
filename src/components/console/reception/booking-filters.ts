import { BOOKING_LIST, BOOKING_PERIODS, ARRIVAL_FILTERS, validBookingDate, type BookingPeriod, type ArrivalFilter } from "@/lib/config/booking-list";
import { RECEPTION_BOOKING_STATUSES, type BookingStatus } from "@/lib/domain/booking";

export const PAYMENT_STATUSES = [
  "open",
  "pending",
  "paid",
  "partially_refunded",
  "fully_refunded",
  "failed",
  "cancelled",
  "manual_review",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const RECEPTION_PAYMENT_FILTERS: readonly PaymentStatus[] = ["paid", "partially_refunded", "fully_refunded"];

export const BOOKING_SOURCES = [
  "online",
  "walk_in",
  "telephone",
  "manual",
  "complimentary",
] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const RECEPTION_SOURCE_FILTERS: readonly BookingSource[] = ["online", "walk_in", "telephone", "manual"];

export const GUEST_TYPES = ["adults_only", "with_children"] as const;

export type GuestType = (typeof GUEST_TYPES)[number];

export const ANY = "any" as const;

export type Filter<T extends string> = T | typeof ANY;

export const BOOKING_STATUS_LABEL: Readonly<Record<BookingStatus, string>> = {
  draft: "Draft",
  held: "Held",
  awaiting_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  hold_expired: "Hold expired",
  awaiting_recovery: "Awaiting recovery",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  no_show: "No show",
  abandoned: "Abandoned",
};

export const PAYMENT_STATUS_LABEL: Readonly<Record<PaymentStatus, string>> = {
  open: "Open",
  pending: "Pending",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  fully_refunded: "Fully refunded",
  failed: "Failed",
  cancelled: "Cancelled",
  manual_review: "Manual review",
};

export const BOOKING_SOURCE_LABEL: Readonly<Record<BookingSource, string>> = {
  online: "Online",
  walk_in: "Walk-in",
  telephone: "Telephone",
  manual: "Manual",
  complimentary: "Complimentary",
};

export const GUEST_TYPE_LABEL: Readonly<Record<GuestType, string>> = {
  adults_only: "Adults only",
  with_children: "With children",
};

function parse<T extends string>(
  allowed: readonly T[],
  value: unknown,
): Filter<T> {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : ANY;
}

export const parseBookingStatus = (value: unknown): Filter<BookingStatus> =>
  parse(RECEPTION_BOOKING_STATUSES, value);

export const parsePaymentStatus = (value: unknown): Filter<PaymentStatus> =>
  parse(RECEPTION_PAYMENT_FILTERS, value);

export const parseBookingSource = (value: unknown): Filter<BookingSource> =>
  parse(RECEPTION_SOURCE_FILTERS, value);

export const parseGuestType = (value: unknown): Filter<GuestType> =>
  parse(GUEST_TYPES, value);

export function parseSuiteFilter(
  value: unknown,
  suiteIds: readonly string[],
): Filter<string> {
  return typeof value === "string" && suiteIds.includes(value) ? value : ANY;
}

export interface BookingSearchQuery {
  readonly search: string;
  readonly status: Filter<BookingStatus>;
  readonly paymentStatus: Filter<PaymentStatus>;
  readonly source: Filter<BookingSource>;
  readonly guestType: Filter<GuestType>;
  readonly suiteId: Filter<string>;
  readonly period: BookingPeriod;
  readonly arrival: Filter<ArrivalFilter>;
  readonly from?: string;
  readonly to?: string;
  readonly page: number;
}

export interface RawBookingSearchParams {
  readonly q?: string;
  readonly status?: string;
  readonly payment?: string;
  readonly source?: string;
  readonly guests?: string;
  readonly suite?: string;
  readonly period?: string;
  readonly arrival?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: string;
}

export function parseBookingSearch(
  params: RawBookingSearchParams,
  suiteIds: readonly string[],
): BookingSearchQuery {
  const page = Number(params.page);
  const from = validBookingDate(params.from);
  const rawTo = validBookingDate(params.to);
  const to = from ? (rawTo && rawTo >= from ? rawTo : from) : undefined;

  return {
    search: typeof params.q === "string" ? params.q.trim() : "",
    status: parseBookingStatus(params.status),
    paymentStatus: parsePaymentStatus(params.payment),
    source: parseBookingSource(params.source),
    guestType: parseGuestType(params.guests),
    suiteId: parseSuiteFilter(params.suite, suiteIds),
    period: BOOKING_PERIODS.includes(params.period as BookingPeriod) ? params.period as BookingPeriod : "all",
    arrival: parse(ARRIVAL_FILTERS, params.arrival),
    from, to,
    page: Number.isSafeInteger(page) && Number.isSafeInteger(page * BOOKING_LIST.pageSize) && page > 0 ? page : 1,
  };
}

export function isFiltered(query: BookingSearchQuery): boolean {
  return (
    query.search.length > 0 ||
    query.status !== ANY ||
    query.paymentStatus !== ANY ||
    query.source !== ANY ||
    query.guestType !== ANY ||
    query.suiteId !== ANY || query.period !== "all" || query.arrival !== ANY || !!query.from
  );
}

export type SearchKey =
  | "name"
  | "mobile"
  | "email"
  | "booking_reference"
  | "payment_reference";

export function searchKeysFor(term: string): readonly SearchKey[] {
  const trimmed = term.trim();
  if (trimmed.length === 0) return [];

  if (trimmed.includes("@")) return ["email"];
  if (/^\+?[\d\s()-]{6,}$/.test(trimmed)) return ["mobile"];
  if (/^[A-Za-z]{2,}-?\d{3,}$/.test(trimmed)) {
    return ["booking_reference", "payment_reference"];
  }

  return ["name", "booking_reference", "payment_reference"];
}
