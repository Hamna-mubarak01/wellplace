import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatAed } from "@/components/shared/money";
import { resetEmailConfigCache } from "@/lib/config/email";
import { INVOICE_COPY } from "@/lib/config/invoice";
import {
  invoiceDocument,
  invoiceEmail,
  invoiceTaxLabel,
  invoiceTaxableFils,
  renderInvoiceDocumentHtml,
} from "@/lib/messaging/templates/invoice";
import {
  SAMPLE_ISSUER_NAME,
  SAMPLE_TRN,
  SUITE_WITH_NUMBER,
  sampleInvoice,
} from "../support/invoice";

beforeEach(() => {
  vi.stubEnv("EMAIL_GUEST_FROM", "hello@wellplace.example");
  vi.stubEnv("EMAIL_ASSET_BASE_URL", "https://wellplace.example");
  resetEmailConfigCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEmailConfigCache();
});

const RECIPIENT = { email: "guest@example.test", firstName: "Amina" };

describe("[Project owner's direction 2026-09-11; INV-01] the tax invoice a guest receives never names a suite", () => {
  it("builds the document without the suite number or suite id the console record carries", () => {
    const invoice = sampleInvoice();
    const serialised = JSON.stringify(invoiceDocument(invoice));

    expect(serialised).not.toMatch(/suite/i);
    expect(serialised).not.toContain(invoice.suiteId ?? "absent");
  });

  it("keeps the suite out of the downloaded and printed HTML", () => {
    const html = renderInvoiceDocumentHtml(invoiceDocument(sampleInvoice()));

    expect(html).not.toMatch(/suite/i);
    expect(html).not.toMatch(SUITE_WITH_NUMBER);
  });

  it("keeps the suite out of the email subject, text and HTML", () => {
    const message = invoiceEmail(invoiceDocument(sampleInvoice()), RECIPIENT);

    for (const part of [message.subject, message.text, message.html ?? ""]) {
      expect(part).not.toMatch(/suite/i);
      expect(part).not.toMatch(SUITE_WITH_NUMBER);
    }
  });
});

describe("[Project owner's direction 2026-09-11] the tax invoice document", () => {
  it("prints the issuer from the invoice's own stored snapshot, with the address split into lines", () => {
    const document = invoiceDocument(sampleInvoice());

    expect(document.title).toBe("Tax invoice");
    expect(document.issuer).toEqual({
      legalName: SAMPLE_ISSUER_NAME,
      trn: SAMPLE_TRN,
      addressLines: ["Unit 1, Example Street", "Test City, UAE"],
    });
    expect(document.billTo).toEqual({
      firstName: "Amina",
      name: "Amina Tester",
      email: "guest@example.test",
      phone: "+971500000000",
      company: null,
      trn: null,
      addressLines: [],
    });
  });

  it("dates the invoice and the visit in Dubai time", () => {
    const document = invoiceDocument(sampleInvoice());

    expect(document.facts).toEqual([
      { label: "Invoice number", value: "INV-2026-000042" },
      { label: "Date of issue", value: "12 September 2026" },
      { label: "Booking reference", value: "WPTEST01" },
      { label: "Visit", value: "12 September 2026 at 14:00 to 17:00" },
    ]);
  });

  it("lists the stored lines, with an included add-on shown as included rather than priced", () => {
    const lines = invoiceDocument(sampleInvoice()).lines;

    expect(lines.map((line) => [line.description, line.detail, line.quantity, line.unitPrice, line.amount])).toEqual([
      ["Visit", "2 adults, 1 child", null, null, formatAed(66000)],
      ["Bathrobe", null, "2", formatAed(2500), formatAed(5000)],
      ["Towel", null, "3", null, "Included"],
      ["Discount", null, null, null, formatAed(-6600)],
      ["Service Fee", null, null, null, formatAed(3864)],
    ]);
  });

  it("totals from the stored figures: VAT included, the taxable amount, the total and the amount paid", () => {
    const totals = invoiceDocument(sampleInvoice()).totals;

    expect(totals.map((total) => [total.label, total.value, total.emphasis])).toEqual([
      ["Subtotal", formatAed(71000), false],
      ["Discount", formatAed(-6600), false],
      ["Service Fee", formatAed(3864), false],
      ["Total", formatAed(68264), true],
      ["VAT (5%) included", formatAed(3067), false],
      ["Taxable amount", formatAed(61333), false],
      ["Amount paid", formatAed(68264), false],
    ]);
  });

  it("prints the taxable amount stored on the invoice, never one re-derived from the total, so a VAT-exempt add-on cannot inflate it", () => {
    expect(invoiceTaxableFils({ taxableFils: 61333 })).toBe(61333);
    expect(invoiceTaxableFils({ taxableFils: 56190 })).toBe(56190);
  });

  it("puts VAT before the total when prices exclude it, and omits discount and fee rows that are zero", () => {
    const totals = invoiceDocument(
      sampleInvoice({
        tax: { label: "VAT", ratePercent: 5, isIncluded: false },
        discountFils: 0,
        serviceFeeFils: 0,
        lines: sampleInvoice().lines.filter((line) => line.kind !== "discount" && line.kind !== "service_fee"),
        taxFils: 3550,
        taxableFils: 71000,
        totalFils: 74550,
        paidFils: 74550,
      }),
    ).totals;

    expect(totals.map((total) => total.label)).toEqual([
      "Subtotal",
      "VAT (5%)",
      "Total",
      "Taxable amount",
      "Amount paid",
    ]);
    expect(totals.find((total) => total.key === "taxable")?.value).toBe(formatAed(71000));
  });

  it("names the tax with its rate, or without one when the rate was not set", () => {
    expect(invoiceTaxLabel({ label: "VAT", ratePercent: 5, isIncluded: true })).toBe("VAT (5%) included");
    expect(invoiceTaxLabel({ label: "VAT", ratePercent: 5.5, isIncluded: false })).toBe("VAT (5.5%)");
    expect(invoiceTaxLabel({ label: "VAT", ratePercent: null, isIncluded: true })).toBe("VAT included");
  });

  it("marks a voided invoice clearly, with the date and reason", () => {
    const document = invoiceDocument(
      sampleInvoice({ voidedAt: "2026-09-13T06:00:00.000Z", voidReason: "Issued to the wrong name", state: "voided" }),
    );
    const html = renderInvoiceDocumentHtml(document);

    expect(document.voided).toEqual({ on: "13 September 2026", reason: "Issued to the wrong name" });
    expect(html).toContain(`${INVOICE_COPY.voidStamp} · Voided on 13 September 2026 · Reason: Issued to the wrong name`);
  });

  it("escapes stored text in the standalone HTML", () => {
    const html = renderInvoiceDocumentHtml(
      invoiceDocument(
        sampleInvoice({
          issuer: { legalName: "<script>alert(1)</script>", trn: SAMPLE_TRN, address: "A & B Street" },
        }),
      ),
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A &amp; B Street");
  });

  it("renders a complete, noindex HTML document with the issuer, number and totals", () => {
    const html = renderInvoiceDocumentHtml(invoiceDocument(sampleInvoice()));

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain("<title>Tax invoice INV-2026-000042</title>");
    expect(html).toContain(SAMPLE_ISSUER_NAME);
    expect(html).toContain(`TRN ${SAMPLE_TRN}`);
    expect(html).toContain(formatAed(68264));
    expect(html).toContain("VAT (5%) included");
  });
});

describe("[Project owner's direction 2026-09-11] the invoice email", () => {
  it("is a transactional email to the bill-to address, carrying the whole invoice in its body", () => {
    const message = invoiceEmail(invoiceDocument(sampleInvoice()), RECIPIENT);

    expect(message.to).toBe("guest@example.test");
    expect(message.kind).toBe("transactional");
    expect(message.subject).toBe("Your WellPlace tax invoice INV-2026-000042");
    expect(message.reference).toBe("invoice_issued-INV-2026-000042");
    expect(message.text).toContain("Your tax invoice, Amina");
    expect(message.text).toContain("Invoice number: INV-2026-000042");
    expect(message.text).toContain(`Issued by: ${SAMPLE_ISSUER_NAME}`);
    expect(message.text).toContain(`TRN: ${SAMPLE_TRN}`);
    expect(message.text).toContain(`Bathrobe × 2: ${formatAed(5000)}`);
    expect(message.text).toContain(`Total: ${formatAed(68264)}`);
    expect(message.text).toContain(`VAT (5%) included: ${formatAed(3067)}`);
    expect(message.text).toContain(`Taxable amount: ${formatAed(61333)}`);
    expect(message.text).toContain(`Amount paid: ${formatAed(68264)}`);
    expect(message.text).toContain(INVOICE_COPY.email.note);
  });

  it("drops the name from the heading rather than printing an empty one", () => {
    const message = invoiceEmail(invoiceDocument(sampleInvoice()), { email: "guest@example.test", firstName: "  " });

    expect(message.text).toContain("Your tax invoice\n");
    expect(message.text).not.toContain("Your tax invoice,");
  });
});
