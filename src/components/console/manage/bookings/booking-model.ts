import type { StatusChipTone } from "@/components/console/shared/status-chip";
import type { ExtensionCheck } from "@/components/console/shared/booking/booking-dialog-types";
import {
  BOOKING_SOURCE_LABEL,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type BookingSource,
  type PaymentStatus,
} from "@/components/console/reception/booking-filters";
import { canPerform, type BookingStatus } from "@/lib/domain/booking";
import { formatDubaiTime } from "@/lib/domain/time";

export type ExtensionVerdict = ExtensionCheck;

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

export type PaymentMethod = "cash" | "card_terminal" | "payment_link" | "online" | "complimentary";

export const PAYMENT_METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  payment_link: "Payment link",
  online: "Online",
  complimentary: "Complimentary",
};

export const REFUNDABLE_PAYMENT: readonly PaymentStatus[] = ["paid", "partially_refunded"];

export const MONEY_TAKEN: readonly PaymentStatus[] = ["paid", "partially_refunded", "fully_refunded"];

export function bookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABEL[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABEL[status];
}

export function sourceLabel(source: BookingSource): string {
  return BOOKING_SOURCE_LABEL[source];
}

export function resolveDisplayStatus(
  status: BookingStatus,
  displayStatus?: BookingStatus | null,
): BookingStatus {
  return displayStatus ?? status;
}

export function bookedViaLabel(source: BookingSource, createdByName?: string | null): string {
  return source === "online" ? "Website" : (createdByName ?? "Reception");
}

export function suiteLabel(suiteNumber: number | null): string {
  return suiteNumber === null ? "No suite" : `Suite ${suiteNumber}`;
}

const MINUTE_MS = 60_000;

export function visitMinutes(startsAt: string, endsAt: string): number {
  const span = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / MINUTE_MS);
  return Number.isFinite(span) && span > 0 ? span : 0;
}

export function durationLabel(minutes: number): string {
  if (minutes <= 0) return "No length recorded";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  const whole = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return rest === 0 ? whole : `${whole} ${rest} min`;
}

export function compactDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function guestsLabel(adults: number, children: number): string {
  const parts = [`${adults} ${adults === 1 ? "adult" : "adults"}`];
  if (children > 0) parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  return parts.join(", ");
}

export function childAgesLabel(ages: readonly (number | null)[]): string | null {
  if (ages.length === 0) return null;
  const known = ages.map((age) => (age === null ? "age not recorded" : String(age)));
  return `Aged ${known.join(", ")}`;
}

export const EXTENDABLE: readonly BookingStatus[] = ["confirmed", "checked_in"];

export interface ActionGateInput {
  readonly status: BookingStatus;
  readonly suiteId: string | null;
  readonly otherSuites: number | null;
}

export interface BookingActionGates {
  readonly extend: string | null;
  readonly changeSuite: string | null;
  readonly reschedule: string | null;
  readonly editDetails: string | null;
}

export function bookingActionGates(input: ActionGateInput): BookingActionGates {
  const status = bookingStatusLabel(input.status).toLowerCase();
  const suiteMissing = input.suiteId === null;

  const extend = !canPerform("extend", input.status)
    ? `Only a confirmed or checked-in visit can be extended. This booking is ${status}.`
    : suiteMissing
      ? "This booking has no suite yet. Give it a suite before extending the visit."
      : null;

  const changeSuite = !canPerform("move", input.status)
    ? `Only a confirmed or checked-in visit can change suite. This booking is ${status}.`
    : input.otherSuites === null
      ? "Suite availability could not be loaded. Refresh the page to try again."
      : input.otherSuites === 0
        ? "There is no other suite in service to move this booking to."
        : null;

  const reschedule = canPerform("reschedule", input.status)
    ? null
    : input.status === "checked_in"
      ? "The guest is already in the suite. Use Extend or Change suite instead."
      : `Only a confirmed visit can be rescheduled. This booking is ${status}.`;

  return { extend, changeSuite, reschedule, editDetails: null };
}

export interface ExtensionVerdictInput {
  readonly endsAt: string;
  readonly extraMinutes: number;
  readonly bufferMinutes: number;
  readonly nextClaimAt: string | null;
  readonly hoursRefusal: string | null;
}

export function extensionVerdict(input: ExtensionVerdictInput): ExtensionVerdict {
  const endMs = Date.parse(input.endsAt);
  const newEndMs = endMs + input.extraMinutes * MINUTE_MS;
  const freeUntilMs =
    input.nextClaimAt === null ? null : Date.parse(input.nextClaimAt) - input.bufferMinutes * MINUTE_MS;
  const freeUntil = freeUntilMs === null ? null : new Date(freeUntilMs).toISOString();

  if (freeUntilMs !== null && input.nextClaimAt !== null && newEndMs > freeUntilMs) {
    const room = Math.floor((freeUntilMs - endMs) / MINUTE_MS);
    const next = formatDubaiTime(input.nextClaimAt);
    return {
      status: "conflict",
      freeUntil,
      message:
        room > 0
          ? `The next booking or closure in this suite starts at ${next}. With cleaning time, this visit can run until ${formatDubaiTime(new Date(freeUntilMs))} at the latest, which is ${room} extra minutes. Choose less time, or change the suite first.`
          : `The next booking or closure in this suite starts at ${next}, so there is no room for extra time with cleaning. Change the suite first, or move the next booking.`,
    };
  }

  if (input.hoursRefusal !== null) {
    return { status: "conflict", freeUntil, message: input.hoursRefusal };
  }

  return { status: "fits", freeUntil };
}

export interface MoneyInput {
  readonly status: BookingStatus;
  readonly totalFils: number | null;
  readonly overrunFils: number | null;
  readonly paidFils: number;
  readonly refundedFils: number | null;
  readonly refundsPendingFils: number | null;
  readonly isComplimentary: boolean;
}

export type BalanceState = "complimentary" | "closed" | "due" | "settled" | "unpriced";

export interface MoneySummary {
  readonly totalFils: number | null;
  readonly overrunFils: number;
  readonly paidFils: number;
  readonly refundedFils: number;
  readonly refundsPendingFils: number;
  readonly netReceivedFils: number;
  readonly balanceFils: number | null;
  readonly balance: BalanceState;
}

export const STANDING_STATUSES: readonly BookingStatus[] = [
  "held",
  "awaiting_payment",
  "payment_failed",
  "awaiting_recovery",
  "confirmed",
  "checked_in",
  "completed",
];

export function moneySummary(input: MoneyInput): MoneySummary {
  const overrunFils = input.overrunFils ?? 0;
  const refundedFils = input.refundedFils ?? 0;
  const refundsPendingFils = input.refundsPendingFils ?? 0;
  const base = {
    totalFils: input.totalFils,
    overrunFils,
    paidFils: input.paidFils,
    refundedFils,
    refundsPendingFils,
    netReceivedFils: input.paidFils - refundedFils,
  };

  if (input.isComplimentary) return { ...base, balanceFils: 0, balance: "complimentary" };
  if (!STANDING_STATUSES.includes(input.status)) return { ...base, balanceFils: null, balance: "closed" };
  if (input.totalFils === null) return { ...base, balanceFils: null, balance: "unpriced" };

  const balanceFils = Math.max(0, input.totalFils + overrunFils - input.paidFils);
  return { ...base, balanceFils, balance: balanceFils > 0 ? "due" : "settled" };
}

export interface PriceInput {
  readonly subtotalFils: number | null;
  readonly discountFils: number | null;
  readonly addonsFils: number | null;
  readonly serviceFeeFils: number | null;
  readonly taxFils: number | null;
  readonly totalFils: number | null;
  readonly overrunFils: number | null;
  readonly overrunMinutes: number | null;
  readonly addons: readonly { name: string; quantity: number; lineTotalFils: number }[];
  readonly visitLabel: string;
  readonly taxLabel: string;
  readonly taxIsIncluded: boolean;
}

export type PriceRowKind = "visit" | "addon" | "discount" | "fee" | "tax" | "adjustment" | "total" | "included" | "overrun";

export interface PriceRow {
  readonly key: string;
  readonly kind: PriceRowKind;
  readonly label: string;
  readonly detail: string | null;
  readonly amountFils: number | null;
}

export function priceRows(input: PriceInput): PriceRow[] {
  if (input.totalFils === null) return [];

  const subtotal = input.subtotalFils ?? 0;
  const discount = input.discountFils ?? 0;
  const addons = input.addonsFils ?? 0;
  const fee = input.serviceFeeFils ?? 0;
  const tax = input.taxFils ?? 0;
  const addonsPriced = addons > 0;

  const rows: PriceRow[] = [
    { key: "visit", kind: "visit", label: "Visit", detail: input.visitLabel, amountFils: subtotal },
  ];

  input.addons.forEach((line, index) => {
    rows.push({
      key: `addon-${index}`,
      kind: "addon",
      label: `${line.name} × ${line.quantity}`,
      detail: addonsPriced ? null : "Included in the price",
      amountFils: addonsPriced ? line.lineTotalFils : null,
    });
  });

  if (discount > 0) rows.push({ key: "discount", kind: "discount", label: "Discount", detail: null, amountFils: -discount });
  if (fee > 0) rows.push({ key: "fee", kind: "fee", label: "Service fee", detail: null, amountFils: fee });
  if (tax > 0 && !input.taxIsIncluded) {
    rows.push({ key: "tax", kind: "tax", label: input.taxLabel, detail: null, amountFils: tax });
  }

  const lineSum = subtotal - discount + addons + fee + (input.taxIsIncluded ? 0 : tax);
  if (lineSum !== input.totalFils) {
    rows.push({
      key: "adjustment",
      kind: "adjustment",
      label: "Price adjustment",
      detail: "Difference between the lines above and the stored total",
      amountFils: input.totalFils - lineSum,
    });
  }

  rows.push({ key: "total", kind: "total", label: "Total", detail: null, amountFils: input.totalFils });

  if (tax > 0 && input.taxIsIncluded) {
    rows.push({ key: "included", kind: "included", label: `Includes ${input.taxLabel}`, detail: null, amountFils: tax });
  }

  if ((input.overrunFils ?? 0) > 0) {
    rows.push({
      key: "overrun",
      kind: "overrun",
      label: "Overstay charge",
      detail:
        input.overrunMinutes === null
          ? "Charged separately from the booking total"
          : `${input.overrunMinutes} min · charged separately from the booking total`,
      amountFils: input.overrunFils,
    });
  }

  return rows;
}
