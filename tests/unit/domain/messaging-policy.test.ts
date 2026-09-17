import { describe, expect, it } from "vitest";

import {
  BOOKING_TEMPLATE_KEYS,
  RESENDABLE_BY_RECEPTION,
  isMarketing,
  isResendableByReception,
  maySend,
  type BookingTemplateKey,
  type SendPolicy,
} from "@/lib/domain/messaging";

const policy = (over: Partial<SendPolicy> = {}): SendPolicy => ({
  marketingEnabled: true,
  templateActive: true,
  channelEnabled: true,
  ...over,
});

describe("§16.1 — disabling marketing communication does not stop required booking messages", () => {
  it("INV-17 — every transactional booking message still sends with marketing off", () => {
    const off = policy({ marketingEnabled: false });

    for (const key of BOOKING_TEMPLATE_KEYS) {
      if (isMarketing(key)) continue;
      expect(maySend(key, off)).toEqual({ allowed: true });
    }
  });

  it("stops a marketing message when marketing is off", () => {
    expect(maySend("review_request", policy({ marketingEnabled: false }))).toEqual({
      allowed: false,
      reason: "marketing_disabled",
    });
  });

  it("sends the marketing message again once marketing is back on", () => {
    expect(maySend("review_request", policy())).toEqual({ allowed: true });
  });

  it("classifies the §12 template set, and only the review request is marketing", () => {
    const marketing = BOOKING_TEMPLATE_KEYS.filter(isMarketing);
    expect(marketing).toEqual(["review_request"]);
  });

  it("never lets a confirmation or a payment message be classed as marketing", () => {
    const critical: BookingTemplateKey[] = [
      "booking_confirmation",
      "payment_received",
      "payment_failed",
      "booking_cancelled",
      "refund_issued",
      "secure_link",
      "payment_link",
    ];

    for (const key of critical) {
      expect(isMarketing(key)).toBe(false);
    }
  });
});

describe("§12 — a template that is switched off, or a channel that is not connected, sends nothing", () => {
  it("refuses an inactive template even when it is transactional", () => {
    expect(maySend("booking_confirmation", policy({ templateActive: false }))).toEqual({
      allowed: false,
      reason: "template_inactive",
    });
  });

  it("refuses an unavailable channel before anything else, so Q-8 reads clearly", () => {
    expect(
      maySend("review_request", policy({ channelEnabled: false, marketingEnabled: false })),
    ).toEqual({ allowed: false, reason: "channel_unavailable" });
  });
});

describe("§9.2 — Reception resends confirmation, reminder, secure link or payment link", () => {
  it("offers exactly the four the contract names", () => {
    expect([...RESENDABLE_BY_RECEPTION].toSorted()).toEqual([
      "booking_confirmation",
      "booking_reminder",
      "payment_link",
      "secure_link",
    ]);
  });

  it("does not let Reception fire a marketing message by hand", () => {
    expect(isResendableByReception("review_request")).toBe(false);
  });

  it("keeps every resendable template transactional, so marketing settings cannot block it", () => {
    for (const key of RESENDABLE_BY_RECEPTION) {
      expect(isMarketing(key)).toBe(false);
      expect(maySend(key, policy({ marketingEnabled: false }))).toEqual({
        allowed: true,
      });
    }
  });
});
