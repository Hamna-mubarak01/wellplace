import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  createClient: vi.fn(),
  deliver: vi.fn(),
  regenerate: vi.fn(),
  voidInvoice: vi.fn(),
  issueInvoice: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireManagement: mocks.guard }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/invoice-notifications", () => ({ deliverTaxDocument: mocks.deliver }));
vi.mock("@/lib/db/rpc", () => ({
  MANAGEMENT_INVOICE_HAS_CREDIT_NOTES: "WP085",
  MANAGEMENT_INVOICE_SETTINGS_INCOMPLETE: "WP076",
  issueInvoice: mocks.issueInvoice,
  regenerateInvoice: mocks.regenerate,
  voidInvoice: mocks.voidInvoice,
}));

import { regenerateTaxInvoice, sendTaxDocument, voidIssuedInvoice } from "@/app/(console)/manage/finance/invoices/actions";
import { regenerateInvoiceSchema } from "@/app/(console)/manage/finance/invoices/invoice-inputs";
import { aedAmount, taxDocumentCsvRow, taxDocumentsCsv } from "@/components/console/manage/finance/tax-documents-csv";
import { INVOICE_COPY, INVOICE_SEND } from "@/lib/config/invoice";
import type { TaxDocumentCsvRow } from "@/lib/db/queries/invoices";

const DOCUMENT_ID = "5b2f8c1e-7a4d-4e6b-9c3f-2d1e0a9b8c7d";
const NEW_INVOICE_ID = "6c3f9d2e-8b5e-4f7c-8d4a-3e2f1b0c9d8e";
const BOOKING_ID = "0b7e4f6a-2c3d-4e5f-8a9b-1c2d3e4f5a6b";

function emailSend(recipients: unknown) {
  return { documentType: "invoice", documentId: DOCUMENT_ID, channel: "email", recipients };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.guard.mockResolvedValue({ role: "management" });
  mocks.createClient.mockResolvedValue({});
  mocks.deliver.mockResolvedValue({ sent: true, messageId: null, to: ["guest@example.test"], notSent: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026] sending an invoice or credit note", () => {
  it("checks the Management session first and sends to the trimmed recipients", async () => {
    const result = await sendTaxDocument(emailSend(["  guest@example.test  "]));

    expect(mocks.guard).toHaveBeenCalledOnce();
    expect(mocks.deliver).toHaveBeenCalledWith(
      {},
      { documentType: "invoice", documentId: DOCUMENT_ID, channel: "email", recipients: ["guest@example.test"] },
    );
    expect(result).toEqual({ ok: true, to: ["guest@example.test"], notSent: [] });
  });

  it.each([
    [[], INVOICE_COPY.console.noRecipients],
    [["not-an-email"], INVOICE_COPY.console.invalidEmail],
    [["a@example.com\r\nBcc: b@example.com"], INVOICE_COPY.console.invalidEmail],
    [["a@example.com", "A@example.com"], INVOICE_COPY.console.duplicateRecipient],
    [
      Array.from({ length: INVOICE_SEND.maxRecipients + 1 }, (_, index) => `guest${index}@example.test`),
      INVOICE_COPY.console.tooManyRecipients.replace("{max}", String(INVOICE_SEND.maxRecipients)),
    ],
  ])("refuses an invalid email recipient list without sending (%#)", async (recipients, message) => {
    expect(await sendTaxDocument(emailSend(recipients))).toEqual({ ok: false, message });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("refuses the WhatsApp channel, which this project does not ship", async () => {
    const result = await sendTaxDocument({ ...emailSend(["+971500000000"]), channel: "whatsapp" });

    expect(result.ok).toBe(false);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("refuses an unknown document type or channel", async () => {
    expect((await sendTaxDocument({ ...emailSend(["guest@example.test"]), documentType: "receipt" })).ok).toBe(false);
    expect((await sendTaxDocument({ ...emailSend(["guest@example.test"]), channel: "sms" })).ok).toBe(false);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("refuses every channel but email before it reaches the delivery service", async () => {
    for (const channel of ["whatsapp", "sms", "post"]) {
      expect((await sendTaxDocument({ ...emailSend(["+971500000000"]), channel })).ok).toBe(false);
    }
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026] regenerating an invoice", () => {
  const valid = {
    invoiceId: DOCUMENT_ID,
    reason: "Customer asked for the company name",
    billTo: { name: "Amina Tester", company: " Tester Trading LLC ", trn: "100-000-000-000-011", address: "" },
  };

  it("strips TRN separators, trims text and sends empty fields as cleared", async () => {
    mocks.regenerate.mockResolvedValue({
      outcome: "ok",
      value: { id: NEW_INVOICE_ID, invoiceNumber: "INV-2026-000043", bookingId: BOOKING_ID },
    });

    const result = await regenerateTaxInvoice(valid);

    expect(mocks.regenerate).toHaveBeenCalledWith(
      {},
      {
        invoiceId: DOCUMENT_ID,
        reason: "Customer asked for the company name",
        billTo: { name: "Amina Tester", company: "Tester Trading LLC", trn: "100000000000011", address: null },
      },
    );
    expect(result).toEqual({ ok: true, invoice: { id: NEW_INVOICE_ID, number: "INV-2026-000043" } });
  });

  it.each([
    [{ ...valid, reason: "  " }],
    [{ ...valid, billTo: { ...valid.billTo, name: "" } }],
    [{ ...valid, billTo: { ...valid.billTo, trn: "12345" } }],
    [{ ...valid, billTo: { ...valid.billTo, trn: "10000000000001A" } }],
    [{ ...valid, billTo: { ...valid.billTo, address: "x".repeat(501) } }],
    [{ ...valid, billTo: { ...valid.billTo, company: "x".repeat(201) } }],
  ])("refuses invalid regenerate input (%#)", async (input) => {
    expect(regenerateInvoiceSchema.safeParse(input).success).toBe(false);
    expect((await regenerateTaxInvoice(input)).ok).toBe(false);
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });

  it("accepts an empty TRN", () => {
    expect(regenerateInvoiceSchema.safeParse({ ...valid, billTo: { ...valid.billTo, trn: "" } }).success).toBe(true);
  });

  it("reports incomplete invoice settings distinctly", async () => {
    mocks.regenerate.mockResolvedValue({ outcome: "refused", code: "WP076", message: "Enter the invoice details." });

    expect(await regenerateTaxInvoice(valid)).toEqual({
      ok: false,
      reason: "settings_incomplete",
      message: "Enter the invoice details.",
    });
  });
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026] voiding an invoice with credit notes", () => {
  it("points to Regenerate when the database refuses with WP085", async () => {
    mocks.voidInvoice.mockResolvedValue({ outcome: "refused", code: "WP085", message: "Has credit notes." });

    expect(await voidIssuedInvoice({ invoiceId: DOCUMENT_ID, reason: "Wrong name" })).toEqual({
      ok: false,
      message: INVOICE_COPY.console.hasCreditNotes,
      hasCreditNotes: true,
    });
  });
});

describe("[OUR CHOICE — project owner's direction, 13 September 2026] the accountant's CSV export", () => {
  const row: TaxDocumentCsvRow = {
    documentType: "credit_note",
    number: "CN-2026-000001",
    issuedAt: "2026-09-13T20:30:00.000Z",
    supplyDate: "2026-09-13",
    bookingReference: "WP-B1001",
    customerReference: "WP-C1042",
    customerName: "=Tester, Amina",
    billToCompany: null,
    billToTrn: "100000000000011",
    taxableFils: 62857,
    taxFils: 3143,
    totalFils: 66000,
    currency: "AED",
    state: "issued",
    isTest: true,
    originalInvoiceNumber: "INV-2026-000042",
    voidReason: null,
  };

  it("converts fils to AED with two decimals, including negatives", () => {
    expect(aedAmount(66000)).toBe("660.00");
    expect(aedAmount(5)).toBe("0.05");
    expect(aedAmount(-6600)).toBe("-66.00");
    expect(aedAmount(0)).toBe("0.00");
  });

  it("writes Dubai dates, the type, references and amounts", () => {
    expect(taxDocumentCsvRow(row)).toEqual([
      "Credit note",
      "CN-2026-000001",
      "14 September 2026 at 00:30",
      "2026-09-13",
      "WP-B1001",
      "WP-C1042",
      "=Tester, Amina",
      "",
      "100000000000011",
      "628.57",
      "31.43",
      "660.00",
      "AED",
      "Valid",
      "Yes",
      "INV-2026-000042",
      "",
    ]);
  });

  it("has a header, a byte order mark, CRLF lines and neutralised formula cells", () => {
    const csv = taxDocumentsCsv([row]);
    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(lines[0].split(",")).toHaveLength(INVOICE_COPY.csv.columns.length);
    expect(lines[1]).toContain('"\t=Tester, Amina"');
    expect(lines[2]).toBe("");
  });
});
