import { describe, expect, it } from "vitest";

import { INVOICE_COPY } from "@/lib/config/invoice";
import { creditNotePdfView, renderCreditNotePdf } from "@/lib/documents/credit-note-pdf-view";

import { sampleCreditNote } from "../support/credit-note";
import { SUITE_WITH_NUMBER } from "../support/invoice";

const RENDER_TIMEOUT_MS = 30_000;

describe("[OUR CHOICE — project owner's direction, 14 September 2026] the tax credit note PDF", () => {
  it(
    "renders a stored credit note to a PDF",
    async () => {
      const pdf = await renderCreditNotePdf(sampleCreditNote());
      expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    },
    RENDER_TIMEOUT_MS,
  );

  it("names the original invoice, the refund, its payment, per-line VAT and the credited totals", () => {
    const view = creditNotePdfView(sampleCreditNote());

    expect(view.kind).toBe("credit_note");
    expect(view.facts).toEqual({
      number: "CN-2026-000007",
      issuedOn: "14 September 2026",
      suppliedOn: "12 September 2026",
      bookingReference: "WP-B1042",
      customerReference: "WP-C1042",
      originalInvoice: { number: "INV-2026-000042", issuedOn: "12 September 2026" },
      paymentStatus: INVOICE_COPY.pdf.refunded,
    });
    expect(view.issuer.addressLines).toEqual(["Unit 1, Example Street", "Test City, UAE"]);
    expect(view.lines).toEqual([
      {
        key: "refund-0",
        description: "Refund against booking WP-B1042",
        detail: null,
        quantity: "1",
        unitPrice: "AED 210.00",
        vatRate: "5%",
        vat: "AED 10.00",
        amount: "AED 210.00",
      },
    ]);
    expect(view.totals.map((total) => [total.key, total.value])).toEqual([
      ["excluding_vat", "AED 200.00"],
      ["tax", "AED 10.00"],
      ["total", "AED 210.00"],
      ["credited", "AED 210.00"],
    ]);
    expect(view.payments).toEqual([
      {
        key: "WP-R1003-0",
        date: "14 September 2026",
        method: "Online",
        reference: "WP-R1003 / WP-P1001",
        providerReference: "sim-refund-1",
        amount: "AED 210.00",
      },
    ]);
    expect(view.notes).toContain(`${INVOICE_COPY.pdf.refundReason}: The guest left early.`);
    expect(view.isTest).toBe(true);
    expect(view.voided).toBeNull();
  });

  it("carries the void and drops an empty reason", () => {
    const view = creditNotePdfView(
      sampleCreditNote({ reason: "  ", voidedAt: "2026-09-15T06:00:00.000Z", voidReason: "Regenerated" }),
    );

    expect(view.voided).toEqual({ on: "15 September 2026", reason: "Regenerated" });
    expect(view.notes).toEqual([INVOICE_COPY.currencyNote]);
  });

  it("[INV-01] never carries a suite", () => {
    const serialised = JSON.stringify(creditNotePdfView(sampleCreditNote()));
    expect(serialised).not.toMatch(/suite/i);
    expect(serialised).not.toMatch(SUITE_WITH_NUMBER);
  });
});
