import { formatAed } from "@/components/shared/money";
import { clockLabel } from "@/lib/config/clock-picker";
import type { GuestReceipt } from "@/lib/config/receipt";
import { DUBAI_TIME_ZONE, formatDubaiTime, todayInDubai } from "@/lib/domain/time";

export type ReceiptTone = "confirmed" | "cancelled" | "refunded";

export interface ReceiptRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface ReceiptTotal extends ReceiptRow {
  readonly emphasis: boolean;
  readonly struck: boolean;
}

export interface ReceiptView {
  readonly tone: ReceiptTone;
  readonly heading: string;
  readonly reference: string;
  readonly guestName: string;
  readonly email: string;
  readonly visitDate: string;
  readonly visitTime: string;
  readonly visit: readonly ReceiptRow[];
  readonly payment: readonly ReceiptRow[];
  readonly lines: readonly ReceiptRow[];
  readonly totals: readonly ReceiptTotal[];
  readonly refunds: readonly ReceiptRow[];
  readonly notice: string | null;
  readonly simulated: boolean;
}

const VISIT_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: DUBAI_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dubaiClock(instant: string): string {
  return clockLabel(formatDubaiTime(instant));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function sentenceCase(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function refundNotice(pendingFils: number, returnedFils: number): string {
  const reason =
    "This payment could not be used for your booking: the time or coupon you chose was no longer available, the booking had changed, or it had already been paid.";
  if (pendingFils > 0) return `${reason} A refund of ${formatAed(pendingFils)} has started. Please choose a new visit.`;
  if (returnedFils > 0) return `${reason} ${formatAed(returnedFils)} has been refunded. Please choose a new visit.`;
  return `${reason} Please choose a new visit.`;
}

export function receiptView(receipt: GuestReceipt): ReceiptView {
  const { identity, selection } = receipt.snapshot.progress;
  const price = receipt.snapshot.breakdown;
  const returnedFils = receipt.refunds.filter((item) => !item.pending).reduce((sum, item) => sum + item.amountFils, 0);
  const pendingFils = receipt.refunds.filter((item) => item.pending).reduce((sum, item) => sum + item.amountFils, 0);
  const notKept = receipt.checkoutResult === "refunded";

  const tone: ReceiptTone = notKept ? "refunded" : receipt.status === "cancelled" ? "cancelled" : "confirmed";
  const heading = notKept
    ? pendingFils === 0 && returnedFils > 0
      ? "Your payment has been refunded"
      : "Your refund has started"
    : tone === "cancelled"
      ? "Booking cancelled"
      : "Your booking is confirmed";

  const startsAt = selection.startsAt;
  const endsAt = startsAt === null ? null : new Date(Date.parse(startsAt) + selection.durationHours * 3_600_000).toISOString();
  const visitDate = startsAt === null ? (selection.date ?? "Date to be confirmed") : VISIT_DATE.format(new Date(startsAt));
  const visitTime = startsAt === null || endsAt === null ? "Not yet scheduled" : `${dubaiClock(startsAt)} – ${dubaiClock(endsAt)}`;
  const children = selection.childAges.length;

  const visit: ReceiptRow[] = [
    { key: "date", label: "Date", value: visitDate },
    { key: "time", label: "Time (Dubai)", value: visitTime },
    { key: "duration", label: "Duration", value: plural(selection.durationHours, "hour", "hours") },
    {
      key: "guests",
      label: "Guests",
      value: [plural(selection.adults, "adult", "adults"), children > 0 ? plural(children, "child", "children") : null].filter(Boolean).join(", "),
    },
  ];
  if (selection.voucherCode) visit.push({ key: "coupon", label: "Coupon", value: selection.voucherCode });

  const payment: ReceiptRow[] = [
    { key: "method", label: "Paid with", value: receipt.paymentOption === "tabby" ? "Tabby" : "Card" },
    { key: "status", label: "Payment status", value: sentenceCase(receipt.paymentStatus) },
  ];
  const paymentReference = receipt.paymentNumber ?? receipt.paymentReference ?? null;
  if (paymentReference) payment.push({ key: "reference", label: "Payment reference", value: paymentReference });

  const lines: ReceiptRow[] = price.lines
    .filter((line) => line.kind !== "tax")
    .map((line) => ({
      key: line.id,
      label: `${line.label}${line.quantity !== null ? ` × ${line.quantity}` : ""}${line.isIncluded ? " · Included" : ""}`,
      value: formatAed(line.amountFils),
    }));

  const totals: ReceiptTotal[] = [];
  if (price.savingFils > 0) {
    totals.push({ key: "regular", label: "Regular total", value: formatAed(price.regularTotalFils), emphasis: false, struck: true });
    totals.push({ key: "savings", label: "You saved", value: formatAed(price.savingFils), emphasis: false, struck: false });
  }
  totals.push({
    key: "tax",
    label: `${receipt.snapshot.taxLabel}${price.taxIsIncluded ? " included" : ""}`,
    value: formatAed(price.taxFils),
    emphasis: false,
    struck: false,
  });
  totals.push({ key: "total", label: "Total paid", value: formatAed(price.totalFils), emphasis: true, struck: false });
  if (pendingFils > 0) totals.push({ key: "pending", label: "Refund pending", value: formatAed(pendingFils), emphasis: false, struck: false });
  if (returnedFils > 0) {
    totals.push({ key: "refunded", label: "Refunded", value: formatAed(returnedFils), emphasis: false, struck: false });
    totals.push({ key: "net", label: "Net paid", value: formatAed(price.totalFils - returnedFils), emphasis: false, struck: false });
  }

  const refunds: ReceiptRow[] = receipt.refunds.map((refund) => ({
    key: refund.id,
    label: `${refund.pending ? "Pending" : "Returned"} · ${todayInDubai(new Date(refund.requestedAt))}`,
    value: `${formatAed(refund.amountFils)} (VAT ${formatAed(refund.taxFils)} included)`,
  }));

  return {
    tone,
    heading,
    reference: receipt.reference,
    guestName: `${identity.firstName} ${identity.lastName}`.trim(),
    email: identity.email,
    visitDate,
    visitTime,
    visit,
    payment,
    lines,
    totals,
    refunds,
    notice: notKept ? refundNotice(pendingFils, returnedFils) : null,
    simulated: receipt.simulated,
  };
}
