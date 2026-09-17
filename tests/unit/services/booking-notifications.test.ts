import { DEFAULT_FOOTER_DESIGN } from "@/lib/config/message-footer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WellPlaceClient } from "@/lib/db/types";
import type { PaymentMessageContext } from "@/lib/db/payment-events";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";

const db = vi.hoisted(() => ({
  readPaymentMessageContext: vi.fn(),
  readAuthoredTemplate: vi.fn(),
  queueGuestMessage: vi.fn(),
  recordGuestMessageAttempt: vi.fn(),
}));

vi.mock("@/lib/db/payment-events", () => db);
vi.mock("@/lib/db/guest-checkout", () => ({ guestReceipt: vi.fn(async () => null), guestDocument: vi.fn(async () => null) }));

import {
  BOOKING_MESSAGE_COPY,
  BOOKING_MESSAGE_KEYS,
  RECOVERY_REFUND_LEAD,
  type BookingMessageKey,
} from "@/lib/config/booking-messages";
import { resetEmailConfigCache } from "@/lib/config/email";
import { RECEIPT_LINK } from "@/lib/config/receipt";
import { SITE_URL } from "@/lib/config/seo";
import { sendBookingMessage } from "@/lib/services/booking-notifications";

const PAYMENT_ID = "6f1b0c2e-9d4a-4c11-8e21-3a5f7d9b0c41";
const MESSAGE_ID = "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d";
const RECEIPT_TOKEN = "4d3c2b1a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const CLIENT = {} as WellPlaceClient;
const NOW = new Date("2040-03-31T21:45:00.000Z");
const VISIT_IN_DUBAI = "Visit: 1 April 2040 at 01:00 to 03:00";
const SUITE_WITH_NUMBER = /\bsuite\s*(?:no\.?|number|#)?\s*\d/i;

const CONTEXT: PaymentMessageContext = {
  paymentId: PAYMENT_ID,
  bookingId: "0b7e4f6a-2c3d-4e5f-8a9b-1c2d3e4f5a6b",
  customerId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  reference: "WPTEST01",
  email: "guest@example.test",
  firstName: "Amina",
  lastName: "Tester",
  startsAt: "2040-03-31T21:00:00.000Z",
  endsAt: "2040-03-31T23:00:00.000Z",
  adults: 2,
  children: 0,
  amountFils: 66000,
  taxFils: 3143,
  taxLabel: "VAT",
  simulated: true,
  result: "confirmed",
  holdExpiresAt: "2040-03-31T21:50:00.000Z",
  receiptToken: RECEIPT_TOKEN,
  refundPendingFils: 66000,
  refundSettledFils: 0,
};

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
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
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetEmailConfigCache();
});

describe("[§12] booking messages about a payment", () => {
  it("[§12; OUR CHOICE] sends nothing when Management switched the template off", async () => {
    db.readAuthoredTemplate.mockResolvedValue({ outcome: "inactive" });
    const { adapter, send } = recordingAdapter();

    const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: false, reason: "inactive", messageId: null });
    expect(send).not.toHaveBeenCalled();
    expect(db.queueGuestMessage).not.toHaveBeenCalled();
    expect(db.recordGuestMessageAttempt).not.toHaveBeenCalled();
  });

  it("[§12] uses the coded wording when no template has been written, queues it and records the delivery", async () => {
    const { adapter, send, sent } = recordingAdapter();

    const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: true, messageId: MESSAGE_ID });
    expect(send).toHaveBeenCalledTimes(1);
    const [message] = sent;
    expect(message.subject).toBe(`${BOOKING_MESSAGE_COPY.booking_confirmation.subject} — WPTEST01`);
    expect(message.text).toContain(BOOKING_MESSAGE_COPY.booking_confirmation.lead);
    expect(message.to).toBe("guest@example.test");
    expect(db.queueGuestMessage).toHaveBeenCalledWith(CLIENT, {
      templateKey: "booking_confirmation",
      bookingId: CONTEXT.bookingId,
      customerId: CONTEXT.customerId,
      toAddress: "guest@example.test",
      subject: message.subject,
      body: message.text,
    });
    expect(db.recordGuestMessageAttempt).toHaveBeenCalledWith(CLIENT, {
      messageId: MESSAGE_ID,
      sent: true,
      providerMessageId: "provider-message-1",
      error: null,
    });
  });

  it("[§12; INV-21] an active template supplies the subject and opening while the stored booking facts still appear", async () => {
    db.readAuthoredTemplate.mockResolvedValue({
      outcome: "active",
      subject: "Your visit is booked",
      body: "We look forward to welcoming you.\n\nArrive ten minutes early to settle in.",
    });
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    const [message] = sent;
    expect(message.subject).toBe("Your visit is booked — WPTEST01");
    expect(message.text).toContain("We look forward to welcoming you.");
    expect(message.text).toContain("Arrive ten minutes early to settle in.");
    expect(message.text).not.toContain(BOOKING_MESSAGE_COPY.booking_confirmation.lead);
    expect(message.text).toContain("Booking reference: WPTEST01");
    expect(message.text).toContain(VISIT_IN_DUBAI);
    expect(message.text).toContain("Paid: AED 660.00");
    expect(message.text).toContain("Includes VAT: AED 31.43");
    expect(message.text).toContain(`${SITE_URL.replace(/\/+$/, "")}${RECEIPT_LINK.path}/${RECEIPT_TOKEN}`);
  });

  it("[§12; R-33] records a failed delivery and reports it instead of throwing", async () => {
    const { adapter } = recordingAdapter({ ok: false, reason: "rejected", message: "domain not verified" });

    const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: false, reason: "not_sent", messageId: MESSAGE_ID });
    expect(db.recordGuestMessageAttempt).toHaveBeenCalledWith(CLIENT, {
      messageId: MESSAGE_ID,
      sent: false,
      providerMessageId: null,
      error: "rejected: domain not verified",
    });
  });

  it("[§12; R-33] records an adapter that throws as a provider error and still does not throw", async () => {
    const adapter: EmailAdapter = {
      name: "exploding",
      send: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    };

    const report = await sendBookingMessage("payment_failed", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: false, reason: "not_sent", messageId: MESSAGE_ID });
    expect(db.recordGuestMessageAttempt).toHaveBeenCalledWith(CLIENT, {
      messageId: MESSAGE_ID,
      sent: false,
      providerMessageId: null,
      error: "provider_error: socket hang up",
    });
  });

  it("[§8.2; INV-11] the automatic refund message explains the payment could not be used and states the full refund", async () => {
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("refund_issued", PAYMENT_ID, CLIENT, { recovery: true }, adapter);

    const [message] = sent;
    expect(message.text).toContain(RECOVERY_REFUND_LEAD);
    expect(message.text).not.toContain(BOOKING_MESSAGE_COPY.refund_issued.lead);
    expect(message.text).toContain("Refund: AED 660.00");
    expect(message.subject).toBe(`${BOOKING_MESSAGE_COPY.refund_issued.subject} — WPTEST01`);
  });

  it("[§12] sends nothing and reports no_context when the payment cannot be read", async () => {
    db.readPaymentMessageContext.mockResolvedValue(null);
    const { adapter, send } = recordingAdapter();

    const report = await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter);

    expect(report).toEqual({ sent: false, reason: "no_context", messageId: null });
    expect(send).not.toHaveBeenCalled();
  });

  it("[§11.1, §13; INV-24] shows the visit and the hold in Dubai time, not UTC", async () => {
    const { adapter, sent } = recordingAdapter();

    await sendBookingMessage("payment_failed", PAYMENT_ID, CLIENT, {}, adapter);

    const [message] = sent;
    expect(message.text).toContain(VISIT_IN_DUBAI);
    expect(message.text).not.toContain("31 March 2040");
    expect(message.text).toContain("Your time is held until 01:50 (Dubai time).");
    expect(message.text).toContain(`${SITE_URL.replace(/\/+$/, "")}/book`);
  });

  it.each(BOOKING_MESSAGE_KEYS.flatMap((key) => [
    { key, wording: "coded" as const },
    { key, wording: "authored" as const },
  ]))(
    "[§3; INV-01] $key with $wording wording never names a suite number",
    async ({ key, wording }: { key: BookingMessageKey; wording: "coded" | "authored" }) => {
      if (wording === "authored") {
        db.readAuthoredTemplate.mockResolvedValue({
          outcome: "active",
          subject: "About your WellPlace visit",
          body: "Thank you for choosing WellPlace.",
        });
      }
      const { adapter, sent } = recordingAdapter();

      await sendBookingMessage(key, PAYMENT_ID, CLIENT, {}, adapter);

      expect(sent).toHaveLength(1);
      const [message] = sent;
      expect(message.subject).not.toMatch(SUITE_WITH_NUMBER);
      expect(message.text).not.toMatch(SUITE_WITH_NUMBER);
      expect(message.html ?? "").not.toMatch(SUITE_WITH_NUMBER);
    },
  );
});

it("[OUR CHOICE; owner request 12 September 2026] uses the saved footer while keeping built-in booking wording", async () => {
  db.readAuthoredTemplate.mockResolvedValue({ outcome: "active", subject: null, body: null, footer: "Custom booking footer", footerDesign: { ...DEFAULT_FOOTER_DESIGN, links: [{ id: "site", icon: "website", label: "Visit WellPlace", href: "https://wellplace.example", enabled: true }] } });
  const { adapter, sent } = recordingAdapter();
  expect((await sendBookingMessage("booking_confirmation", PAYMENT_ID, CLIENT, {}, adapter)).sent).toBe(true);
  expect(sent[0].text).toContain("Custom booking footer");
  expect(sent[0].html).toContain("Custom booking footer");
  expect(sent[0].html).toContain("website-brand.png");
  expect(sent[0].text).toContain(BOOKING_MESSAGE_COPY.booking_confirmation.lead);
});
