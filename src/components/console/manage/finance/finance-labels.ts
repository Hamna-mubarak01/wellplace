import type { StatusChipTone } from "@/components/console/shared/status-chip";
import type { InvoiceState } from "@/lib/db/invoice-record";
import type { LedgerPaymentMethod, LedgerPaymentStatus } from "@/lib/db/queries/management-payments";
import type { RefundOrigin, RefundState } from "@/lib/db/queries/management-refunds";
import { DUBAI_TIME_ZONE } from "@/lib/domain/time";

export const PAYMENT_METHOD_OPTIONS: readonly LedgerPaymentMethod[] = [
  "cash",
  "card_terminal",
  "payment_link",
  "online",
  "complimentary",
];

export const PAYMENT_METHOD_LABEL: Readonly<Record<LedgerPaymentMethod, string>> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  payment_link: "Payment link",
  online: "Online",
  complimentary: "Complimentary",
};

export const PAYMENT_STATUS_LABEL: Readonly<Record<LedgerPaymentStatus, string>> = {
  open: "Open",
  pending: "Pending",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  fully_refunded: "Fully refunded",
  failed: "Failed",
  cancelled: "Cancelled",
  manual_review: "Manual review",
};

export const PAYMENT_STATUS_TONE: Readonly<Record<LedgerPaymentStatus, StatusChipTone>> = {
  open: "neutral",
  pending: "warning",
  paid: "success",
  partially_refunded: "info",
  fully_refunded: "info",
  failed: "danger",
  cancelled: "neutral",
  manual_review: "danger",
};

export const PAYMENT_STATUS_FILTERS = [
  "awaiting",
  "paid",
  "partially_refunded",
  "fully_refunded",
  "failed",
  "cancelled",
  "manual_review",
] as const;

export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTERS)[number];

export const PAYMENT_STATUS_FILTER: Readonly<
  Record<PaymentStatusFilter, { readonly label: string; readonly statuses: readonly LedgerPaymentStatus[] }>
> = {
  awaiting: { label: "Awaiting payment", statuses: ["open", "pending"] },
  paid: { label: PAYMENT_STATUS_LABEL.paid, statuses: ["paid"] },
  partially_refunded: { label: PAYMENT_STATUS_LABEL.partially_refunded, statuses: ["partially_refunded"] },
  fully_refunded: { label: PAYMENT_STATUS_LABEL.fully_refunded, statuses: ["fully_refunded"] },
  failed: { label: PAYMENT_STATUS_LABEL.failed, statuses: ["failed"] },
  cancelled: { label: PAYMENT_STATUS_LABEL.cancelled, statuses: ["cancelled"] },
  manual_review: { label: PAYMENT_STATUS_LABEL.manual_review, statuses: ["manual_review"] },
};

const REFUNDABLE_STATUSES: ReadonlySet<LedgerPaymentStatus> = new Set(["paid", "partially_refunded"]);

export function isRefundable(payment: { readonly status: LedgerPaymentStatus; readonly refundableFils: number }): boolean {
  return REFUNDABLE_STATUSES.has(payment.status) && payment.refundableFils > 0;
}

export const REFUND_STATE_OPTIONS: readonly RefundState[] = ["pending", "returned", "withdrawn"];

export const REFUND_STATE_LABEL: Readonly<Record<RefundState, string>> = {
  pending: "Pending",
  returned: "Returned",
  withdrawn: "Withdrawn",
};

export const REFUND_STATE_TONE: Readonly<Record<RefundState, StatusChipTone>> = {
  pending: "warning",
  returned: "success",
  withdrawn: "neutral",
};

export const REFUND_ORIGIN_OPTIONS: readonly RefundOrigin[] = ["automatic", "staff"];

export const REFUND_ORIGIN_LABEL: Readonly<Record<RefundOrigin, string>> = {
  automatic: "Automatic",
  staff: "Staff",
};

export const REFUND_ORIGIN_TONE: Readonly<Record<RefundOrigin, StatusChipTone>> = {
  automatic: "info",
  staff: "neutral",
};

export function refundOrigin(refund: { readonly isAutomatic: boolean }): RefundOrigin {
  return refund.isAutomatic ? "automatic" : "staff";
}

export function canConfirmReturn(refund: { readonly state: RefundState }): boolean {
  return refund.state === "pending";
}

export function canWithdraw(refund: { readonly state: RefundState; readonly isAutomatic: boolean }): boolean {
  return refund.state === "pending" && !refund.isAutomatic;
}

export const INVOICE_STATE_OPTIONS: readonly InvoiceState[] = ["issued", "voided"];

export const INVOICE_STATE_LABEL: Readonly<Record<InvoiceState, string>> = {
  issued: "Issued",
  voided: "Void",
};

export const INVOICE_STATE_TONE: Readonly<Record<InvoiceState, StatusChipTone>> = {
  issued: "success",
  voided: "danger",
};

export function suiteLabel(suiteNumber: number | null): string | null {
  return suiteNumber === null ? null : `Suite ${suiteNumber}`;
}

const DUBAI_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function financeDay(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? "" : DUBAI_DAY.format(date);
}
