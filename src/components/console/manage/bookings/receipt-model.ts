import type { BookingDetail } from "@/lib/db/queries/bookings";
import type { BookingRefundRecord } from "@/lib/db/queries/bookings-page";
import type { PaymentRow } from "@/lib/db/queries/payments";
import { formatAed } from "@/components/shared/money";
import {
  MONEY_TAKEN,
  PAYMENT_METHOD_LABEL,
  bookingStatusLabel,
  childAgesLabel,
  durationLabel,
  guestsLabel,
  moneySummary,
  paymentStatusLabel,
  priceRows,
  visitMinutes,
  type PriceRow,
} from "@/components/console/manage/bookings/booking-model";
import { DUBAI_TIME_ZONE, formatDubaiDateTime, formatDubaiTime } from "@/lib/domain/time";

export interface ReceiptPayment {
  readonly key: string;
  readonly method: string;
  readonly recordedAt: string;
  readonly reference: string | null;
  readonly status: string;
  readonly amountFils: number;
  readonly simulated: boolean;
}

export interface ReceiptRefund {
  readonly key: string;
  readonly requestedAt: string;
  readonly settledAt: string | null;
  readonly state: "Returned" | "Waiting to be returned";
  readonly amountFils: number;
}

export interface BookingReceiptDocument {
  readonly reference: string;
  readonly issuedAt: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly status: string;
  readonly visitDay: string;
  readonly visitTime: string;
  readonly length: string;
  readonly guests: string;
  readonly childAges: string | null;
  readonly addons: readonly string[];
  readonly isComplimentary: boolean;
  readonly lines: readonly PriceRow[];
  readonly payments: readonly ReceiptPayment[];
  readonly refunds: readonly ReceiptRefund[];
  readonly paidFils: number;
  readonly refundedFils: number;
  readonly balanceFils: number | null;
  readonly simulated: boolean;
}

export type ReceiptBooking = Pick<
  BookingDetail,
  | "reference"
  | "status"
  | "guestName"
  | "guestEmail"
  | "startsAt"
  | "endsAt"
  | "adults"
  | "children"
  | "guests"
  | "addons"
  | "isComplimentary"
  | "subtotalFils"
  | "discountFils"
  | "addonsFils"
  | "serviceFeeFils"
  | "taxFils"
  | "totalFils"
  | "overrunFils"
  | "overrunMinutes"
>;

export interface ReceiptInput {
  readonly booking: ReceiptBooking;
  readonly payments: readonly PaymentRow[];
  readonly refunds: readonly BookingRefundRecord[];
  readonly taxLabel: string;
  readonly taxIsIncluded: boolean;
  readonly issuedAt: Date;
}

const RECEIPT_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function buildBookingReceipt(input: ReceiptInput): BookingReceiptDocument {
  const { booking } = input;
  const minutes = visitMinutes(booking.startsAt, booking.endsAt);
  const taken = input.payments.filter((payment) => MONEY_TAKEN.includes(payment.status));
  const live = input.refunds.filter((refund) => refund.withdrawnAt === null);
  const paidFils = taken.reduce((sum, payment) => sum + payment.amountFils, 0);
  const refundedFils = live
    .filter((refund) => refund.settledAt !== null)
    .reduce((sum, refund) => sum + refund.amountFils, 0);
  const pendingFils = live
    .filter((refund) => refund.settledAt === null && refund.isPending)
    .reduce((sum, refund) => sum + refund.amountFils, 0);

  const money = moneySummary({
    status: booking.status,
    totalFils: booking.totalFils,
    overrunFils: booking.overrunFils,
    paidFils,
    refundedFils,
    refundsPendingFils: pendingFils,
    isComplimentary: booking.isComplimentary,
  });

  return {
    reference: booking.reference,
    issuedAt: input.issuedAt.toISOString(),
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    status: bookingStatusLabel(booking.status),
    visitDay: RECEIPT_DAY.format(new Date(booking.startsAt)),
    visitTime: `${formatDubaiTime(booking.startsAt)}–${formatDubaiTime(booking.endsAt)}`,
    length: durationLabel(minutes),
    guests: guestsLabel(booking.adults, booking.children),
    childAges: childAgesLabel(booking.guests.filter((guest) => guest.kind === "child").map((guest) => guest.age)),
    addons: booking.addons.map((addon) => `${addon.name} × ${addon.quantity}`),
    isComplimentary: booking.isComplimentary,
    lines: priceRows({
      subtotalFils: booking.subtotalFils,
      discountFils: booking.discountFils,
      addonsFils: booking.addonsFils,
      serviceFeeFils: booking.serviceFeeFils,
      taxFils: booking.taxFils,
      totalFils: booking.totalFils,
      overrunFils: booking.overrunFils,
      overrunMinutes: booking.overrunMinutes,
      addons: booking.addons,
      visitLabel: `${durationLabel(minutes)} · ${guestsLabel(booking.adults, booking.children)}`,
      taxLabel: input.taxLabel,
      taxIsIncluded: input.taxIsIncluded,
    }),
    payments: taken.map((payment) => ({
      key: payment.id,
      method: PAYMENT_METHOD_LABEL[payment.method],
      recordedAt: payment.recordedAt,
      reference: payment.providerReference,
      status: paymentStatusLabel(payment.status),
      amountFils: payment.amountFils,
      simulated: payment.isSimulated === true,
    })),
    refunds: live.map((refund) => ({
      key: refund.id,
      requestedAt: refund.requestedAt,
      settledAt: refund.settledAt,
      state: refund.settledAt === null ? "Waiting to be returned" : "Returned",
      amountFils: refund.amountFils,
    })),
    paidFils,
    refundedFils,
    balanceFils: money.balanceFils,
    simulated: taken.some((payment) => payment.isSimulated === true),
  };
}

export function receiptFilename(reference: string): string {
  return `WellPlace-receipt-${reference.replace(/[^0-9A-Za-z-]+/g, "-")}.html`;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function amountCell(fils: number | null): string {
  return fils === null ? "Included" : formatAed(fils);
}

function row(label: string, value: string, className = ""): string {
  return `<tr${className ? ` class="${className}"` : ""}><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

const RECEIPT_STYLE = [
  "body{font:15px/1.6 system-ui,sans-serif;max-width:42rem;margin:2.5rem auto;padding:0 1.25rem}",
  "h1{font-size:1.5rem;margin:0}",
  "h2{font-size:1rem;margin:2rem 0 .5rem}",
  "p{margin:.25rem 0}",
  "table{width:100%;border-collapse:collapse}",
  "th,td{padding:.375rem 0;text-align:left;vertical-align:top;font-weight:400}",
  "td.amount,th.amount,td:last-child{text-align:right;font-variant-numeric:tabular-nums}",
  "tr.total th,tr.total td{font-weight:700;border-top:1px solid}",
  "small{display:block;opacity:.75}",
].join("");

export function receiptHtml(receipt: BookingReceiptDocument): string {
  const lines = receipt.lines
    .map((line) => {
      const label = line.detail === null ? escapeHtml(line.label) : `${escapeHtml(line.label)}<small>${escapeHtml(line.detail)}</small>`;
      return `<tr${line.kind === "total" ? ' class="total"' : ""}><th scope="row">${label}</th><td>${escapeHtml(amountCell(line.amountFils))}</td></tr>`;
    })
    .join("");

  const payments = receipt.payments.length === 0
    ? "<p>No payment has been received.</p>"
    : `<table>${receipt.payments
        .map((payment) => {
          const detail = [formatDubaiDateTime(payment.recordedAt), payment.reference, payment.simulated ? "Simulation, no money charged" : null]
            .filter((part): part is string => Boolean(part))
            .join(" · ");
          return `<tr><th scope="row">${escapeHtml(payment.method)} · ${escapeHtml(payment.status)}<small>${escapeHtml(detail)}</small></th><td>${escapeHtml(formatAed(payment.amountFils))}</td></tr>`;
        })
        .join("")}</table>`;

  const refunds = receipt.refunds.length === 0
    ? ""
    : `<h2>Refunds</h2><table>${receipt.refunds
        .map((refund) => {
          const when = refund.settledAt === null ? `Requested ${formatDubaiDateTime(refund.requestedAt)}` : `Returned ${formatDubaiDateTime(refund.settledAt)}`;
          return `<tr><th scope="row">${escapeHtml(refund.state)}<small>${escapeHtml(when)}</small></th><td>${escapeHtml(formatAed(refund.amountFils))}</td></tr>`;
        })
        .join("")}</table>`;

  const visit = [
    row("Date", receipt.visitDay),
    row("Time (Dubai)", receipt.visitTime),
    row("Length", receipt.length),
    row("Guests", receipt.childAges === null ? receipt.guests : `${receipt.guests} (${receipt.childAges.toLowerCase()})`),
    ...(receipt.addons.length === 0 ? [] : [row("Add-ons", receipt.addons.join(", "))]),
  ].join("");

  const summary = [
    row("Paid", formatAed(receipt.paidFils)),
    ...(receipt.refundedFils > 0 ? [row("Refunded", formatAed(receipt.refundedFils))] : []),
    ...(receipt.balanceFils === null ? [] : [row("Balance due", formatAed(receipt.balanceFils), "total")]),
  ].join("");

  const price = receipt.lines.length === 0
    ? `<p>${receipt.isComplimentary ? "Complimentary visit." : "No price is stored for this booking."}</p>`
    : `<table>${lines}</table>`;

  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">',
    `<title>WellPlace receipt ${escapeHtml(receipt.reference)}</title>`,
    `<style>${RECEIPT_STYLE}</style></head><body>`,
    "<p>WellPlace</p>",
    `<h1>Receipt ${escapeHtml(receipt.reference)}</h1>`,
    "<p>This is a receipt, not a tax invoice.</p>",
    receipt.simulated ? "<p><strong>Simulation. No money was charged.</strong></p>" : "",
    `<p>Issued ${escapeHtml(formatDubaiDateTime(receipt.issuedAt))} (Dubai time) · ${escapeHtml(receipt.status)}</p>`,
    `<h2>Guest</h2><p>${escapeHtml(receipt.guestName || "Name not recorded")}</p>`,
    receipt.guestEmail ? `<p>${escapeHtml(receipt.guestEmail)}</p>` : "",
    `<h2>Visit</h2><table>${visit}</table>`,
    `<h2>Price</h2>${price}`,
    `<h2>Payments</h2>${payments}`,
    refunds,
    `<h2>Summary</h2><table>${summary}</table>`,
    "</body></html>",
  ].join("");
}
