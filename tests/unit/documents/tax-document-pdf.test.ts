import { describe, expect, it } from "vitest";

import { invoicePdfView, type InvoicePdfSource } from "@/lib/documents/invoice-pdf-view";
import { renderTaxDocumentPdf, taxDocumentPdfFilename, type TaxDocumentView } from "@/lib/documents/tax-document-pdf";

import { SUITE_WITH_NUMBER, sampleInvoice } from "../support/invoice";

const RENDER_TIMEOUT_MS = 30_000;

const CREDIT_NOTE: TaxDocumentView = {
  kind: "credit_note",
  facts: {
    number: "CN-2026-000007",
    issuedOn: "14 September 2026",
    suppliedOn: "12 September 2026",
    bookingReference: "WP-B1042",
    customerReference: "WP-C1042",
    originalInvoice: { number: "INV-2026-000042", issuedOn: "12 September 2026" },
    paymentStatus: "Refunded",
  },
  issuer: {
    legalName: "Example Test Trading Co",
    trn: "100000000000003",
    addressLines: ["Unit 1, Example Street", "Test City, UAE"],
  },
  billTo: {
    name: "Amina Tester",
    company: null,
    trn: null,
    addressLines: [],
    email: "guest@example.test",
    phone: "+971500000000",
  },
  lines: [
    {
      key: "credit-0",
      description: "Credit against booking WP-B1042",
      detail: null,
      quantity: "1",
      unitPrice: "AED 210.00",
      vatRate: "5%",
      vat: "AED 10.00",
      amount: "AED 210.00",
    },
  ],
  totals: [
    { key: "excluding_vat", label: "Total excluding VAT", value: "AED 200.00", emphasis: false },
    { key: "tax", label: "VAT (5%)", value: "AED 10.00", emphasis: false },
    { key: "total", label: "Total (AED)", value: "AED 210.00", emphasis: true },
    { key: "credited", label: "Amount credited", value: "AED 210.00", emphasis: false },
  ],
  payments: [
    {
      key: "WP-R1003-0",
      date: "14 September 2026",
      method: "Online",
      reference: "WP-R1003",
      providerReference: "c3f1e2d4-5b6a-4c7d-9e8f-0a1b2c3d4e5f",
      amount: "AED 210.00",
    },
  ],
  notes: ["All amounts are in UAE dirhams (AED).", "Reason for credit: The guest left early."],
  isTest: true,
  voided: null,
};

function pdfSignature(buffer: Buffer): string {
  return buffer.subarray(0, 4).toString("latin1");
}

describe("[OUR CHOICE — project owner's direction, 14 September 2026] tax document PDFs", () => {
  it(
    "renders a stored invoice to a PDF",
    async () => {
      expect(pdfSignature(await renderTaxDocumentPdf(invoicePdfView(sampleInvoice())))).toBe("%PDF");
    },
    RENDER_TIMEOUT_MS,
  );

  it(
    "renders a tax credit note to a PDF",
    async () => {
      expect(pdfSignature(await renderTaxDocumentPdf(CREDIT_NOTE))).toBe("%PDF");
    },
    RENDER_TIMEOUT_MS,
  );

  it("names the file after the document number and nothing else", () => {
    expect(taxDocumentPdfFilename("INV-2026-000042")).toBe("INV-2026-000042.pdf");
    expect(taxDocumentPdfFilename('INV-2026/"000042')).toBe("INV-2026000042.pdf");
  });
});

describe("the invoice PDF view", () => {
  it("maps today's invoice record and takes the date of supply from the visit", () => {
    const view = invoicePdfView(sampleInvoice());

    expect(view.kind).toBe("invoice");
    expect(view.facts).toEqual({
      number: "INV-2026-000042",
      issuedOn: "12 September 2026",
      suppliedOn: "12 September 2026",
      bookingReference: "WPTEST01",
      customerReference: null,
      originalInvoice: null,
      paymentStatus: "Paid",
    });
    expect(view.billTo).toEqual({
      name: "Amina Tester",
      company: null,
      trn: null,
      addressLines: [],
      email: "guest@example.test",
      phone: "+971500000000",
    });
    expect(view.lines.every((line) => line.vat === null && line.vatRate === null)).toBe(true);
    expect(view.totals.map((total) => total.key)).toEqual([
      "subtotal",
      "discount",
      "service_fee",
      "excluding_vat",
      "tax",
      "total",
      "paid",
    ]);
    expect(view.totals.find((total) => total.key === "excluding_vat")?.value).toBe("AED 651.97");
    expect(view.totals.find((total) => total.key === "tax")?.label).toBe("VAT (5%)");
    expect(view.payments).toEqual([]);
    expect(view.isTest).toBe(false);
    expect(view.voided).toBeNull();
  });

  it("carries bill-to company, TRN and address, supply date, per-line VAT, payments and the test flag when the record has them", () => {
    const base = sampleInvoice();
    const source: InvoicePdfSource = {
      ...base,
      customerReference: "WP-C1042",
      supplyDate: "2026-09-13",
      isTest: true,
      billTo: { ...base.billTo, company: "Tester Trading LLC", trn: "100000000000011", address: "Office 1\nDubai, UAE" },
      lines: base.lines.map((line) => ({ ...line, vatRatePercent: 5, vatFils: 100 })),
      payments: [
        {
          reference: "WP-P1001",
          method: "online",
          providerReference: "sim-123",
          amountFils: 68264,
          paidAt: "2026-09-11T20:00:00.000Z",
        },
      ],
    };

    const view = invoicePdfView(source);

    expect(view.facts.customerReference).toBe("WP-C1042");
    expect(view.facts.suppliedOn).toBe("13 September 2026");
    expect(view.isTest).toBe(true);
    expect(view.billTo).toMatchObject({
      company: "Tester Trading LLC",
      trn: "100000000000011",
      addressLines: ["Office 1", "Dubai, UAE"],
    });
    expect(view.lines[0]).toMatchObject({ vatRate: "5%", vat: "AED 1.00" });
    expect(view.payments).toEqual([
      {
        key: "WP-P1001-0",
        date: "12 September 2026",
        method: "Online",
        reference: "WP-P1001",
        providerReference: "sim-123",
        amount: "AED 682.64",
      },
    ]);
  });

  it("[INV-01] never carries the suite", () => {
    const serialised = JSON.stringify(invoicePdfView(sampleInvoice()));

    expect(serialised).not.toMatch(/suite/i);
    expect(serialised).not.toMatch(SUITE_WITH_NUMBER);
  });
});
