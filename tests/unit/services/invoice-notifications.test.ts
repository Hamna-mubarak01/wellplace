import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WellPlaceClient } from "@/lib/db/types";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";

const db = vi.hoisted(() => ({
  readAuthoredTemplate: vi.fn(),
  queueGuestMessage: vi.fn(),
  recordGuestMessageAttempt: vi.fn(),
  findInvoice: vi.fn(),
  findCreditNote: vi.fn(),
}));

vi.mock("@/lib/db/payment-events", () => ({
  readAuthoredTemplate: db.readAuthoredTemplate,
  queueGuestMessage: db.queueGuestMessage,
  recordGuestMessageAttempt: db.recordGuestMessageAttempt,
}));

vi.mock("@/lib/db/queries/invoices", () => ({
  findInvoice: db.findInvoice,
  findCreditNote: db.findCreditNote,
}));

import { resetEmailConfigCache } from "@/lib/config/email";
import { INVOICE_COPY, INVOICE_MESSAGE_KEY } from "@/lib/config/invoice";
import { deliverTaxDocument, sendInvoiceEmail } from "@/lib/services/invoice-notifications";
import {
  SAMPLE_BOOKING_ID,
  SAMPLE_CUSTOMER_ID,
  SAMPLE_INVOICE_ID,
  SUITE_WITH_NUMBER,
  sampleInvoice,
} from "../support/invoice";

const CLIENT = {} as WellPlaceClient;
const MESSAGE_ID = "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d";

function recordingAdapter(result: SendResult = { ok: true, providerId: "provider-message-1" }) {
  const sent: EmailMessage[] = [];
  const send = vi.fn(async (message: EmailMessage) => {
    sent.push(message);
    return result;
  });
  const adapter: EmailAdapter = { name: "recording", send };
  return { adapter, send, sent };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_GUEST_FROM", "hello@wellplace.example");
  vi.stubEnv("EMAIL_ASSET_BASE_URL", "https://wellplace.example");
  resetEmailConfigCache();
  db.readAuthoredTemplate.mockResolvedValue({ outcome: "absent" });
  db.findInvoice.mockResolvedValue({ outcome: "found", invoice: sampleInvoice() });
  db.queueGuestMessage.mockResolvedValue(MESSAGE_ID);
  db.recordGuestMessageAttempt.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEmailConfigCache();
});

describe("[Project owner's direction 2026-09-11; §12] emailing a tax invoice", () => {
  it("queues the email under invoice_issued, sends it and records the delivery", async () => {
    const { adapter, send, sent } = recordingAdapter();

    const report = await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter);

    expect(report).toEqual({ sent: true, messageId: MESSAGE_ID, to: "guest@example.test" });
    expect(send).toHaveBeenCalledTimes(1);
    const [message] = sent;
    expect(db.queueGuestMessage).toHaveBeenCalledWith(CLIENT, {
      templateKey: INVOICE_MESSAGE_KEY,
      bookingId: SAMPLE_BOOKING_ID,
      customerId: SAMPLE_CUSTOMER_ID,
      toAddress: "guest@example.test",
      subject: message.subject,
      body: message.text,
      channel: "email",
    });
    expect(db.recordGuestMessageAttempt).toHaveBeenCalledWith(CLIENT, {
      messageId: MESSAGE_ID,
      sent: true,
      providerMessageId: "provider-message-1",
      error: null,
      channel: "email",
    });
    expect(INVOICE_MESSAGE_KEY).toBe("invoice_issued");
  });

  it("[INV-01] logs and sends a body with no suite number in it", async () => {
    const { adapter, sent } = recordingAdapter();

    await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter);

    const queued = db.queueGuestMessage.mock.calls[0][1] as { subject: string; body: string };
    for (const part of [queued.subject, queued.body, sent[0].html ?? ""]) {
      expect(part).not.toMatch(/suite/i);
      expect(part).not.toMatch(SUITE_WITH_NUMBER);
    }
  });

  it("never sends a voided invoice", async () => {
    db.findInvoice.mockResolvedValue({
      outcome: "found",
      invoice: sampleInvoice({ voidedAt: "2026-09-13T06:00:00.000Z", voidReason: "Wrong name", state: "voided" }),
    });
    const { adapter, send } = recordingAdapter();

    const report = await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter);

    expect(report).toEqual({ sent: false, reason: "voided", messageId: null });
    expect(send).not.toHaveBeenCalled();
    expect(db.queueGuestMessage).not.toHaveBeenCalled();
  });

  it("reports a missing or unreadable invoice without sending anything", async () => {
    const { adapter, send } = recordingAdapter();

    db.findInvoice.mockResolvedValueOnce({ outcome: "not_found" });
    expect(await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter)).toEqual({
      sent: false,
      reason: "not_found",
      messageId: null,
    });

    db.findInvoice.mockResolvedValueOnce({ outcome: "failed", message: "unavailable" });
    expect(await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter)).toEqual({
      sent: false,
      reason: "unavailable",
      messageId: null,
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("records a refused delivery as a failed attempt", async () => {
    const { adapter } = recordingAdapter({ ok: false, reason: "rejected", message: "Resend responded 422" });

    const report = await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter);

    expect(report).toEqual({ sent: false, reason: "not_sent", messageId: MESSAGE_ID });
    expect(db.recordGuestMessageAttempt).toHaveBeenCalledWith(CLIENT, {
      messageId: MESSAGE_ID,
      sent: false,
      providerMessageId: null,
      error: "rejected: Resend responded 422",
      channel: "email",
    });
  });

  it("never throws when the adapter or the read throws", async () => {
    const throwing: EmailAdapter = {
      name: "throwing",
      send: vi.fn(async () => {
        throw new Error("socket closed");
      }),
    };

    await expect(sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, throwing)).resolves.toEqual({
      sent: false,
      reason: "not_sent",
      messageId: MESSAGE_ID,
    });

    db.findInvoice.mockRejectedValueOnce(new Error("network"));
    await expect(sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, recordingAdapter().adapter)).resolves.toEqual({
      sent: false,
      reason: "not_sent",
      messageId: null,
    });
  });

  it("still sends when the message log could not queue it, without recording an attempt", async () => {
    db.queueGuestMessage.mockResolvedValue(null);
    const { adapter, send } = recordingAdapter();

    const report = await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter);

    expect(report).toEqual({ sent: true, messageId: null, to: "guest@example.test" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.recordGuestMessageAttempt).not.toHaveBeenCalled();
  });
});

it("[OUR CHOICE; owner request 12 September 2026] reads and sends the configured invoice footer", async () => {
  db.readAuthoredTemplate.mockResolvedValue({ outcome: "active", subject: null, body: null, footer: "Custom invoice footer" });
  const { adapter, sent } = recordingAdapter();
  expect((await sendInvoiceEmail(SAMPLE_INVOICE_ID, CLIENT, adapter)).sent).toBe(true);
  expect(sent[0].text).toContain("Custom invoice footer");
  expect(sent[0].html).toContain("Custom invoice footer");
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026] sending a tax document from the console", () => {
  it("sends each email recipient a separate message with the PDF attached, and logs one message per recipient", async () => {
    const { adapter, sent } = recordingAdapter();

    const report = await deliverTaxDocument(
      CLIENT,
      { documentType: "invoice", documentId: SAMPLE_INVOICE_ID, channel: "email", recipients: ["guest@example.test", "accounts@example.test"] },
      { email: adapter },
    );

    expect(report).toEqual({ sent: true, messageId: MESSAGE_ID, to: ["guest@example.test", "accounts@example.test"], notSent: [] });
    expect(sent.map((message) => message.to)).toEqual(["guest@example.test", "accounts@example.test"]);
    for (const message of sent) {
      expect(message.attachments?.some((file) => "content" in file && file.filename.endsWith(".pdf"))).toBe(true);
      expect(message.text).toContain(INVOICE_COPY.email.note);
    }
    expect(db.queueGuestMessage).toHaveBeenCalledTimes(2);
  });

  it("refuses the WhatsApp channel outright, before reading or queueing anything", async () => {
    const report = await deliverTaxDocument(
      CLIENT,
      { documentType: "invoice", documentId: SAMPLE_INVOICE_ID, channel: "whatsapp", recipients: ["+971500000000"] },
    );

    expect(report).toEqual({ sent: false, reason: "whatsapp_not_ready", messageId: null });
    expect(db.findInvoice).not.toHaveBeenCalled();
    expect(db.queueGuestMessage).not.toHaveBeenCalled();
  });

  it("never sends a voided credit note", async () => {
    db.findCreditNote.mockResolvedValue({ outcome: "found", creditNote: { voidedAt: "2026-09-13T06:00:00.000Z", state: "voided" } });
    const { adapter, send } = recordingAdapter();

    const report = await deliverTaxDocument(
      CLIENT,
      { documentType: "credit_note", documentId: SAMPLE_INVOICE_ID, channel: "email", recipients: ["guest@example.test"] },
      { email: adapter },
    );

    expect(report).toEqual({ sent: false, reason: "voided", messageId: null });
    expect(send).not.toHaveBeenCalled();
  });
});
