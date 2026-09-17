import { beforeEach, describe, expect, it } from "vitest";

import { resetEmailConfigCache } from "@/lib/config/email";
import type { EmailAdapter, EmailMessage, SendResult } from "@/lib/messaging/types";
import {
  sendContactEmails,
  sendContactNotification,
} from "@/lib/services/contact-notifications";

const enquiry = {
  firstName: "Amina",
  lastName: "Haddad",
  email: "amina@example.test",
  phone: { e164: "+971501234567", countryIso2: "AE" },
  message: "I would like help planning a private group visit.",
  termsAccepted: true as const,
  website: "",
};

function recordingAdapter(result: SendResult = { ok: true, providerId: "id" }) {
  const sent: EmailMessage[] = [];
  const adapter: EmailAdapter = {
    name: "recording",
    async send(message) {
      sent.push(message);
      return result;
    },
  };
  return { adapter, sent };
}

beforeEach(() => {
  resetEmailConfigCache();
  process.env.EMAIL_OPERATIONS_FROM = "notifications@wellplace.example";
  process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example";
  process.env.EMAIL_GUEST_FROM = "hello@wellplace.example";
  process.env.EMAIL_ASSET_BASE_URL = "https://wellplace.example";
});

describe("contact enquiry delivery — §4.3", () => {
  it("sends the operations notification and the visitor acknowledgement", async () => {
    const { adapter, sent } = recordingAdapter();

    const report = await sendContactEmails(enquiry, adapter);

    expect(report.operations.ok).toBe(true);
    expect(report.guest.ok).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent.map((message) => message.to)).toEqual([
      ["hello@wellplace.example"],
      "amina@example.test",
    ]);
  });

  it("reports the operations result, which is the one that must land", async () => {
    const { adapter } = recordingAdapter({
      ok: false,
      reason: "rejected",
      message: "domain not verified",
    });

    const result = await sendContactNotification(enquiry, adapter);

    expect(result.ok).toBe(false);
  });

  it("still reaches the WellPlace mailbox when the acknowledgement throws", async () => {
    const sent: EmailMessage[] = [];
    const adapter: EmailAdapter = {
      name: "half-broken",
      async send(message) {
        if (message.to === enquiry.email) throw new Error("mailbox refused");
        sent.push(message);
        return { ok: true, providerId: "ops" };
      },
    };

    const report = await sendContactEmails(enquiry, adapter);

    expect(report.operations.ok).toBe(true);
    expect(report.guest.ok).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(["hello@wellplace.example"]);
  });
});
