import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WellPlaceClient } from "@/lib/db/types";
import type { PaymentMessageContext } from "@/lib/db/payment-events";
import type { EmailAdapter, EmailMessage } from "@/lib/messaging/types";

const db = vi.hoisted(() => ({
  readPaymentMessageContext: vi.fn(),
  readAuthoredTemplate: vi.fn(),
  queueGuestMessage: vi.fn(),
  recordGuestMessageAttempt: vi.fn(),
}));

const guest = vi.hoisted(() => ({ guestReceipt: vi.fn(), guestDocument: vi.fn() }));

vi.mock("@/lib/db/payment-events", () => db);
vi.mock("@/lib/db/guest-checkout", () => guest);

import { TAX_DOCUMENT_ATTACHMENT_NOTE } from "@/lib/config/booking-messages";
import { resetEmailConfigCache } from "@/lib/config/email";
import { sendBookingMessage } from "@/lib/services/booking-notifications";

import { SAMPLE_CREDIT_NOTE_ID, sampleCreditNote } from "../support/credit-note";
import { SAMPLE_INVOICE_ID, sampleInvoice } from "../support/invoice";

const PAYMENT_ID = "6f1b0c2e-9d4a-4c11-8e21-3a5f7d9b0c41";
const MESSAGE_ID = "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d";
const RECEIPT_TOKEN = "4d3c2b1a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const REFUND_ID = sampleCreditNote().refundId;
const CLIENT = {} as WellPlaceClient;
const RENDER_TIMEOUT_MS = 30_000;

const CONTEXT: PaymentMessageContext = {
  paymentId: PAYMENT_ID,
  bookingId: "0b7e4f6a-2c3d-4e5f-8a9b-1c2d3e4f5a6b",
  customerId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  reference: "WPTEST01",
  email: "guest@example.test",
  firstName: "Amina",
  lastName: "Tester",
  startsAt: "2026-09-12T10:00:00.000Z",
  endsAt: "2026-09-12T13:00:00.000Z",
  adults: 2,
  children: 1,
  amountFils: 68264,
  taxFils: 3067,
  taxLabel: "VAT",
  simulated: true,
  result: "confirmed",
  holdExpiresAt: null,
  receiptToken: RECEIPT_TOKEN,
  refundPendingFils: 0,
  refundSettledFils: 21000,
};

const INVOICE_SUMMARY = {
  id: SAMPLE_INVOICE_ID,
  type: "invoice",
  number: "INV-2026-000042",
  issuedAt: "2026-09-11T20:30:00.000Z",
  totalFils: 68264,
  taxFils: 3067,
  currency: "AED",
  isTest: true,
  invoiceNumber: null,
};

const CREDIT_NOTE_SUMMARY = {
  id: SAMPLE_CREDIT_NOTE_ID,
  type: "credit_note",
  number: "CN-2026-000007",
  issuedAt: "2026-09-14T06:00:00.000Z",
  totalFils: 21000,
  taxFils: 1000,
  currency: "AED",
  isTest: true,
  invoiceNumber: "INV-2026-000042",
};

const SETTLED_REFUND = {
  id: REFUND_ID,
  amountFils: 21000,
  taxFils: 1000,
  pending: false,
  settledAt: "2026-09-14T05:55:00.000Z",
  requestedAt: "2026-09-13T08:00:00.000Z",
};

const INVOICE_WITH_PAYMENT = {
  type: "invoice",
  bookingReference: "WPTEST01",
  invoice: sampleInvoice({
    isTest: true,
    payments: [
      {
        paymentId: PAYMENT_ID,
        reference: "WP-P1001",
        method: "online",
        providerReference: null,
        amountFils: 68264,
        vatFils: 3067,
        paidAt: "2026-09-11T20:00:00.000Z",
        isTest: true,
      },
    ],
  }),
};

function recordingAdapter() {
  const sent: EmailMessage[] = [];
  const adapter: EmailAdapter = {
    name: "recording",
    send: vi.fn(async (message: EmailMessage) => {
      sent.push(message);
      return { ok: true as const, providerId: "provider-message-1" };
    }),
  };
  return { adapter, sent };
}

function pdfAttachments(message: EmailMessage) {
  return (message.attachments ?? []).filter(
    (attachment): attachment is { filename: string; content: string } => "content" in attachment,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_GUEST_FROM", "hello@wellplace.example");
  vi.stubEnv("EMAIL_ASSET_BASE_URL", "https://wellplace.example");
  resetEmailConfigCache();
  db.readPaymentMessageContext.mockResolvedValue(CONTEXT);
  db.readAuthoredTemplate.mockResolvedValue({ outcome: "absent" });
  db.queueGuestMessage.mockResolvedValue(MESSAGE_ID);
  db.recordGuestMessageAttempt.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEmailConfigCache();
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026] tax document PDFs on booking emails", () => {
  it(
    "attaches the invoice that covers this payment to the confirmation and says so in the body",
    async () => {
      guest.guestReceipt.mockResolvedValue({ documents: [INVOICE_SUMMARY], refunds: [] });
      guest.guestDocument.mockResolvedValue(INVOICE_WITH_PAYMENT);
      const { adapter, sent } = recordingAdapter();

      const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

      expect(report.sent).toBe(true);
      expect(guest.guestDocument).toHaveBeenCalledWith(RECEIPT_TOKEN, SAMPLE_INVOICE_ID);
      const [attachment] = pdfAttachments(sent[0]);
      expect(attachment.filename).toBe("INV-2026-000042.pdf");
      expect(Buffer.from(attachment.content, "base64").subarray(0, 4).toString("latin1")).toBe("%PDF");
      expect(sent[0].text).toContain(TAX_DOCUMENT_ATTACHMENT_NOTE.invoice.replace("{number}", "INV-2026-000042"));
    },
    RENDER_TIMEOUT_MS,
  );

  it("does not attach an invoice that does not cover this payment", async () => {
    guest.guestReceipt.mockResolvedValue({ documents: [INVOICE_SUMMARY], refunds: [] });
    guest.guestDocument.mockResolvedValue({ ...INVOICE_WITH_PAYMENT, invoice: sampleInvoice({ payments: [] }) });
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(pdfAttachments(sent[0])).toEqual([]);
    expect(sent[0].text).not.toContain("attached to this email");
  });

  it("[R-33] still sends the email, without the attachment or its mention, when the document cannot be loaded", async () => {
    guest.guestReceipt.mockResolvedValue({ documents: [INVOICE_SUMMARY], refunds: [] });
    guest.guestDocument.mockRejectedValue(new Error("Your document could not be loaded."));
    const { adapter, sent } = recordingAdapter();

    const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: true, messageId: MESSAGE_ID });
    expect(pdfAttachments(sent[0])).toEqual([]);
    expect(sent[0].text).not.toContain("attached to this email");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("is sent without its tax document"),
      "Your document could not be loaded.",
    );
  });

  it("[R-33] still sends the email when the receipt cannot be read at all", async () => {
    guest.guestReceipt.mockRejectedValue(new Error("Your receipt could not be loaded."));
    const { adapter, sent } = recordingAdapter();

    expect((await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter)).sent).toBe(true);
    expect(pdfAttachments(sent[0])).toEqual([]);
  });

  it(
    "attaches the credit note issued for the settled refund to the refund email",
    async () => {
      guest.guestReceipt.mockResolvedValue({
        documents: [INVOICE_SUMMARY, CREDIT_NOTE_SUMMARY],
        refunds: [SETTLED_REFUND],
      });
      guest.guestDocument.mockResolvedValue({
        type: "credit_note",
        bookingReference: "WPTEST01",
        creditNote: sampleCreditNote(),
      });
      const { adapter, sent } = recordingAdapter();

      await sendBookingMessage("refund_issued", PAYMENT_ID, CLIENT, { refundFils: 21000 }, adapter);

      expect(guest.guestDocument).toHaveBeenCalledWith(RECEIPT_TOKEN, SAMPLE_CREDIT_NOTE_ID);
      expect(pdfAttachments(sent[0]).map((attachment) => attachment.filename)).toEqual(["CN-2026-000007.pdf"]);
      expect(sent[0].text).toContain(TAX_DOCUMENT_ATTACHMENT_NOTE.credit_note.replace("{number}", "CN-2026-000007"));
    },
    RENDER_TIMEOUT_MS,
  );

  it("does not attach a credit note that belongs to a different refund", async () => {
    guest.guestReceipt.mockResolvedValue({ documents: [CREDIT_NOTE_SUMMARY], refunds: [SETTLED_REFUND] });
    guest.guestDocument.mockResolvedValue({
      type: "credit_note",
      bookingReference: "WPTEST01",
      creditNote: sampleCreditNote({ refundId: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" }),
    });
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("refund_issued", PAYMENT_ID, CLIENT, { refundFils: 21000 }, adapter);

    expect(pdfAttachments(sent[0])).toEqual([]);
  });

  it("attaches nothing while the refund is still pending, and never looks for a document on the recovery refund", async () => {
    guest.guestReceipt.mockResolvedValue({
      documents: [CREDIT_NOTE_SUMMARY],
      refunds: [{ ...SETTLED_REFUND, pending: true, settledAt: null }],
    });
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("refund_issued", PAYMENT_ID, CLIENT, { refundFils: 21000 }, adapter);
    expect(guest.guestDocument).not.toHaveBeenCalled();
    expect(pdfAttachments(sent[0])).toEqual([]);

    await sendBookingMessage("refund_issued", PAYMENT_ID, CLIENT, { recovery: true }, adapter);
    expect(guest.guestReceipt).toHaveBeenCalledTimes(1);
  });
});
