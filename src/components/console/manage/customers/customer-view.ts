import { parsePhoneNumberFromString } from "libphonenumber-js";

import type { StatusChipTone } from "@/components/console/shared/status-chip";
import { findCountry } from "@/components/shared/countries";
import { findLegalDocument } from "@/lib/config/legal/documents";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { calculateAge } from "@/lib/domain/age";
import { DUBAI_TIME_ZONE, formatDubaiTime, todayInDubai, toCalendarDate } from "@/lib/domain/time";
import type {
  AcceptanceDocument,
  CustomerDocument,
  InvoiceDocument,
  ManagementCustomer,
} from "@/lib/db/queries/management-customers";
import type { BookingStatus, PaymentStatus } from "@/lib/db/queries/management-bookings";
import type { LedgerPaymentMethod, PaymentLedgerRow } from "@/lib/db/queries/management-payments";

export const RETURNING_COMPLETED_VISITS = MANAGEMENT_LIST.returningCompletedVisits;

export type CustomerFlagId = "blocked";

export type CustomerStatusId = "lead" | "customer" | "returning";

export interface CustomerStatus {
  readonly id: CustomerStatusId;
  readonly label: string;
  readonly tone: StatusChipTone;
}

export interface CustomerFlag {
  readonly id: CustomerFlagId;
  readonly label: string;
  readonly tone: StatusChipTone;
}

export interface CustomerReceipt {
  readonly bookingId: string;
  readonly bookingReference: string;
  readonly lastPaidAt: string;
  readonly receivedFils: number;
  readonly simulated: boolean;
}

export const SALUTATION_LABEL: Readonly<Record<NonNullable<ManagementCustomer["salutation"]>, string>> = {
  mr: "Mr.",
  ms: "Ms.",
};

export const PAYMENT_METHOD_LABEL: Readonly<Record<LedgerPaymentMethod, string>> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  payment_link: "Payment link",
  online: "Online",
  complimentary: "Complimentary",
};

export const BOOKING_STATUS_TONE: Readonly<Record<BookingStatus, StatusChipTone>> = {
  draft: "neutral",
  held: "warning",
  awaiting_payment: "warning",
  payment_failed: "danger",
  hold_expired: "neutral",
  awaiting_recovery: "danger",
  confirmed: "brand",
  checked_in: "success",
  completed: "neutral",
  rescheduled: "neutral",
  cancelled: "neutral",
  no_show: "danger",
  abandoned: "neutral",
};

export const PAYMENT_STATUS_TONE: Readonly<Record<PaymentStatus, StatusChipTone>> = {
  open: "neutral",
  pending: "warning",
  paid: "success",
  partially_refunded: "info",
  fully_refunded: "info",
  failed: "danger",
  cancelled: "neutral",
  manual_review: "danger",
};

const RECEIVED_STATUSES: ReadonlySet<PaymentStatus> = new Set(["paid", "partially_refunded", "fully_refunded"]);

const DUBAI_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DUBAI_WEEKDAY_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const DUBAI_DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "long",
});

const CALENDAR_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validInstant(instant: string): Date | null {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isReturning(customer: Pick<ManagementCustomer, "completedCount">): boolean {
  return customer.completedCount >= RETURNING_COMPLETED_VISITS;
}

export function customerFlags(customer: Pick<ManagementCustomer, "isBlocked">): CustomerFlag[] {
  return customer.isBlocked ? [{ id: "blocked", label: "Blocked", tone: "danger" }] : [];
}

export function customerStatus(customer: Pick<ManagementCustomer, "isLead" | "completedCount">): CustomerStatus {
  if (customer.isLead) return { id: "lead", label: "Lead", tone: "neutral" };
  if (isReturning(customer)) return { id: "returning", label: "Returning", tone: "brand" };
  return { id: "customer", label: "Customer", tone: "info" };
}

export function displayName(customer: Pick<ManagementCustomer, "fullName">): string {
  const name = customer.fullName.trim();
  return name === "" ? "Name not given" : name;
}

export function salutationLabel(salutation: ManagementCustomer["salutation"]): string | null {
  return salutation === null ? null : SALUTATION_LABEL[salutation];
}

export function formatPhone(e164: string): string {
  const trimmed = e164.trim();
  if (trimmed === "") return "";
  return parsePhoneNumberFromString(trimmed)?.formatInternational() ?? trimmed;
}

export function countryName(iso2: string): string | null {
  const code = iso2.trim();
  if (code === "") return null;
  return findCountry(code)?.name ?? code.toUpperCase();
}

export function formatCalendarDate(isoDate: string): string {
  if (!ISO_DATE.test(isoDate)) return "";
  const date = validInstant(`${isoDate}T00:00:00Z`);
  return date === null ? "" : CALENDAR_DAY.format(date);
}

export function ageOn(dateOfBirth: string | null, today: string): number | null {
  if (dateOfBirth === null || !ISO_DATE.test(dateOfBirth) || !ISO_DATE.test(today)) return null;
  if (dateOfBirth > today) return null;
  const reference = validInstant(`${today}T00:00:00Z`);
  if (reference === null) return null;
  const age = calculateAge(toCalendarDate(dateOfBirth), reference);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

export function ageToday(dateOfBirth: string | null, now: Date = new Date()): number | null {
  return ageOn(dateOfBirth, todayInDubai(now));
}

export function formatDubaiDate(instant: string | null): string {
  if (instant === null) return "";
  const date = validInstant(instant);
  return date === null ? "" : DUBAI_DAY.format(date);
}

export function formatVisitDay(instant: string): string {
  const date = validInstant(instant);
  return date === null ? "" : DUBAI_WEEKDAY_DAY.format(date);
}

export function formatVisitTimes(startsAt: string, endsAt: string): string {
  const from = formatDubaiTime(startsAt);
  const to = formatDubaiTime(endsAt);
  if (from === "" || to === "") return from || to;
  return `${from}–${to}`;
}

export function formatMonthStart(instant: string): string {
  const date = validInstant(instant);
  return date === null ? "" : DUBAI_DAY_MONTH.format(date);
}

export function suiteLabel(suiteNumber: number | null): string | null {
  return suiteNumber === null ? null : `Suite ${suiteNumber}`;
}

export function documentTitle(slug: string): string {
  const known = findLegalDocument(slug);
  if (known !== undefined) return known.title;
  const words = slug.split("-").filter((word) => word !== "").join(" ");
  return words === "" ? slug : `${words[0].toUpperCase()}${words.slice(1)}`;
}

export function splitDocuments(documents: readonly CustomerDocument[]): {
  invoices: InvoiceDocument[];
  acceptances: AcceptanceDocument[];
} {
  const invoices: InvoiceDocument[] = [];
  const acceptances: AcceptanceDocument[] = [];
  for (const document of documents) {
    if (document.kind === "invoice") invoices.push(document);
    else acceptances.push(document);
  }
  return { invoices, acceptances };
}

export function receiptsFromPayments(payments: readonly PaymentLedgerRow[]): CustomerReceipt[] {
  const byBooking = new Map<string, CustomerReceipt>();
  for (const payment of payments) {
    if (!RECEIVED_STATUSES.has(payment.status)) continue;
    const existing = byBooking.get(payment.bookingId);
    if (existing === undefined) {
      byBooking.set(payment.bookingId, {
        bookingId: payment.bookingId,
        bookingReference: payment.bookingReference,
        lastPaidAt: payment.recordedAt,
        receivedFils: payment.amountFils,
        simulated: payment.isSimulated,
      });
      continue;
    }
    byBooking.set(payment.bookingId, {
      ...existing,
      lastPaidAt: Date.parse(payment.recordedAt) > Date.parse(existing.lastPaidAt) ? payment.recordedAt : existing.lastPaidAt,
      receivedFils: existing.receivedFils + payment.amountFils,
      simulated: existing.simulated && payment.isSimulated,
    });
  }
  return [...byBooking.values()].toSorted((a, b) => Date.parse(b.lastPaidAt) - Date.parse(a.lastPaidAt));
}

export function bookingHref(bookingId: string): string {
  return `/manage/bookings/${encodeURIComponent(bookingId)}`;
}

export function receiptHref(bookingId: string): string {
  return `${bookingHref(bookingId)}/receipt`;
}

export function invoiceHref(invoiceId: string): string {
  return `/manage/finance/invoices/${encodeURIComponent(invoiceId)}`;
}
