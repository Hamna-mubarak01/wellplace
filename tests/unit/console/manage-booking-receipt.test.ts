import { describe, expect, it } from "vitest";

import {
  buildBookingReceipt,
  escapeHtml,
  receiptFilename,
  receiptHtml,
  type ReceiptBooking,
} from "@/components/console/manage/bookings/receipt-model";
import {
  BOOKINGS_CSV_COLUMNS,
  bookingExportRow,
  bookingsCsv,
  csvField,
} from "@/components/console/manage/bookings/bookings-csv";
import type { BookingRefundRecord } from "@/lib/db/queries/bookings-page";
import type { ManagementBookingRow } from "@/lib/db/queries/management-bookings";
import type { PaymentRow } from "@/lib/db/queries/payments";

const BOOKING: ReceiptBooking = {
  reference: "WP-2026-0042",
  status: "completed",
  guestName: "Mariam <Haddad>",
  guestEmail: "mariam@example.test",
  startsAt: "2026-09-12T10:00:00Z",
  endsAt: "2026-09-12T12:00:00Z",
  adults: 2,
  children: 1,
  guests: [
    { kind: "adult", age: null },
    { kind: "adult", age: null },
    { kind: "child", age: 9 },
  ],
  addons: [{ name: "Bathrobe", quantity: 1, unitPriceFils: 1_500, lineTotalFils: 1_500 }],
  isComplimentary: false,
  subtotalFils: 60_000,
  discountFils: 0,
  addonsFils: 1_500,
  serviceFeeFils: 0,
  taxFils: 2_929,
  totalFils: 61_500,
  overrunFils: null,
  overrunMinutes: null,
};

function payment(overrides: Partial<PaymentRow> & Pick<PaymentRow, "id" | "status" | "amountFils">): PaymentRow {
  return {
    bookingId: "b",
    method: "card_terminal",
    serviceFeeFils: 0,
    providerReference: null,
    note: null,
    recordedAt: "2026-09-12T09:55:00Z",
    recordedByName: "Omar",
    ...overrides,
  };
}

function refund(overrides: Partial<BookingRefundRecord> & Pick<BookingRefundRecord, "id" | "amountFils">): BookingRefundRecord {
  return {
    paymentId: "p1",
    taxFils: 0,
    reason: "Guest asked",
    isPending: false,
    isAutomatic: false,
    requestedAt: "2026-09-12T13:00:00Z",
    settledAt: "2026-09-12T14:00:00Z",
    withdrawnAt: null,
    ...overrides,
  };
}

const RECEIPT = buildBookingReceipt({
  booking: BOOKING,
  payments: [
    payment({ id: "p1", status: "partially_refunded", amountFils: 61_500, providerReference: "TRM-88" }),
    payment({ id: "p2", status: "failed", amountFils: 61_500 }),
  ],
  refunds: [
    refund({ id: "r1", amountFils: 1_500 }),
    refund({ id: "r2", amountFils: 2_000, isPending: true, settledAt: null }),
    refund({ id: "r3", amountFils: 9_000, withdrawnAt: "2026-09-12T13:30:00Z", settledAt: null }),
  ],
  taxLabel: "VAT",
  taxIsIncluded: true,
  issuedAt: new Date("2026-09-12T15:00:00Z"),
});

describe("[CLIENT console redesign brief] a receipt is built from the booking's stored figures", () => {
  it("counts only money actually taken and refunds not withdrawn", () => {
    expect(RECEIPT.payments.map((entry) => entry.key)).toEqual(["p1"]);
    expect(RECEIPT.paidFils).toBe(61_500);
    expect(RECEIPT.refunds.map((entry) => [entry.key, entry.state])).toEqual([
      ["r1", "Returned"],
      ["r2", "Waiting to be returned"],
    ]);
    expect(RECEIPT.refundedFils).toBe(1_500);
    expect(RECEIPT.balanceFils).toBe(0);
  });

  it("shows the stored total with VAT included and the visit in Dubai time", () => {
    expect(RECEIPT.lines.find((line) => line.kind === "total")?.amountFils).toBe(61_500);
    expect(RECEIPT.lines.find((line) => line.kind === "included")).toMatchObject({ label: "Includes VAT", amountFils: 2_929 });
    expect(RECEIPT.visitDay).toMatch(/^Saturday,? 12 September 2026$/);
    expect(RECEIPT.visitTime).toBe("14:00–16:00");
    expect(RECEIPT.guests).toBe("2 adults, 1 child");
    expect(RECEIPT.childAges).toBe("Aged 9");
  });
});

describe("[INV-01] the receipt a guest may be handed never names a suite", () => {
  it("contains no suite number, and says it is not a tax invoice", () => {
    const html = receiptHtml(RECEIPT);
    expect(html).not.toMatch(/suite/i);
    expect(html).toContain("This is a receipt, not a tax invoice.");
    expect(JSON.stringify(RECEIPT)).not.toMatch(/suite/i);
  });

  it("escapes every stored value it prints", () => {
    const html = receiptHtml(RECEIPT);
    expect(html).toContain("Mariam &lt;Haddad&gt;");
    expect(html).not.toContain("<Haddad>");
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("names the download after the reference only", () => {
    expect(receiptFilename("WP-2026-0042")).toBe("WellPlace-receipt-WP-2026-0042.html");
    expect(receiptFilename("WP/../x")).toBe("WellPlace-receipt-WP-x.html");
  });
});

describe("[CLIENT console redesign brief] the bookings CSV names the suite and guards against formulas", () => {
  const row: ManagementBookingRow = {
    id: "b1",
    reference: "WP-2026-0042",
    status: "confirmed",
    source: "walk_in",
    suiteId: "s1",
    suiteNumber: 5,
    customerId: "c1",
    guestName: "=HYPERLINK(\"x\")",
    guestEmail: "mariam@example.test",
    guestPhone: "+971500000000",
    startsAt: "2026-09-12T10:00:00Z",
    endsAt: "2026-09-12T12:00:00Z",
    adults: 2,
    children: 0,
    paymentStatus: "paid",
    totalFils: 61_550,
    isComplimentary: false,
    createdAt: "2026-09-10T08:00:00Z",
  };

  it("writes one labelled row per booking, with the suite", () => {
    expect(BOOKINGS_CSV_COLUMNS).toContain("Suite");
    const values = bookingExportRow(row);
    expect(values[BOOKINGS_CSV_COLUMNS.indexOf("Suite")]).toBe("Suite 5");
    expect(values[BOOKINGS_CSV_COLUMNS.indexOf("Total (AED)")]).toBe("615.50");
    expect(values[BOOKINGS_CSV_COLUMNS.indexOf("Length (minutes)")]).toBe("120");
    expect(values[BOOKINGS_CSV_COLUMNS.indexOf("Source")]).toBe("Walk-in");
  });

  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(csvField("=SUM(A1)")).toBe('"\t=SUM(A1)"');
    expect(csvField("+971500000000")).toBe('"\t+971500000000"');
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("plain")).toBe("plain");
  });

  it("starts with a byte-order mark and ends each line with CRLF", () => {
    const csv = bookingsCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});
