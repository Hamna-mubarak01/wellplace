import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetEmailConfigCache } from "@/lib/config/email";
import { defaultDocument, variableCatalogue, type SystemMessageKey } from "@/lib/config/message-documents";
import { text, variable } from "@/lib/domain/email/document";
import { authoredEmail } from "@/lib/messaging/templates/authored";
import type { EmailAdapter, EmailMessage } from "@/lib/messaging/types";
import { sendContactEmails } from "@/lib/services/contact-notifications";
import { authoredMessage } from "@/lib/services/message-document-service";
import { sendWaitlistEmails } from "@/lib/services/waitlist-notifications";
import type { WaitlistSubmission } from "@/lib/validation/waitlist";

vi.mock("@/lib/services/message-document-service", () => ({ authoredMessage: vi.fn() }));

const customer = {
  firstName: "Amina", lastName: "Khalil", email: "amina@example.test",
  phone: { e164: "+971509876543", countryIso2: "AE" }, termsAccepted: true as const,
};
const signup: WaitlistSubmission = {
  ...customer, salutation: "ms", dateOfBirth: { day: 13, month: 9, year: 1995 },
  attribution: { source: "website", utmSource: "newsletter", utmMedium: "email", utmCampaign: "opening",
    utmContent: "welcome", utmTerm: "wellness", referrer: "https://wellplace.example/waitlist" },
};
let sent: EmailMessage[];
const adapter: EmailAdapter = {
  name: "recording", async send(message) { sent.push(message); return { ok: true, providerId: "test" }; },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEmailConfigCache();
  process.env.EMAIL_OPERATIONS_FROM = "notifications@wellplace.example";
  process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example";
  process.env.EMAIL_GUEST_FROM = "hello@wellplace.example";
  sent = [];
  vi.mocked(authoredMessage).mockImplementation(async (key, values, options) => {
    const document = defaultDocument(key)!;
    const nodes = variableCatalogue(key).flatMap((name) => [text(`${name}: `), variable(name), text(" | ")]);
    return authoredEmail({ key, values, to: options?.to, stored: {
      ...document, subject: nodes, preheader: nodes, blocks: [{ id: "details", kind: "text", align: "left", size: "normal", content: nodes }],
    } });
  });
});

function valuesFor(key: SystemMessageKey) {
  const call = vi.mocked(authoredMessage).mock.calls.find(([calledKey]) => calledKey === key)!;
  expect(Object.keys(call[1]).sort()).toEqual([...variableCatalogue(key)].sort());
  return call[1];
}

describe("customer email variables — project owner's direction, 12 September 2026", () => {
  it("renders collected waitlist details in the subject, preview line and body for both recipients", async () => {
    await sendWaitlistEmails({ submission: signup, submittedAt: "2026-09-12T20:01:00Z" }, adapter);
    for (const key of ["waitlist_confirmation", "waitlist_signup_notification"] as const) {
      expect(valuesFor(key)).toMatchObject({
        first_name: "Amina", last_name: "Khalil", full_name: "Ms Amina Khalil", salutation: "Ms",
        phone: "+971509876543", phone_country: "AE", date_of_birth: "13 September 1995", age: "31",
      });
    }
    expect(valuesFor("waitlist_signup_notification")).toMatchObject({
      source: "website", campaign: "opening", utm_source: "newsletter", utm_medium: "email",
      utm_content: "welcome", utm_term: "wellness", referrer: "https://wellplace.example/waitlist",
    });
    expect(sent).toHaveLength(2);
    for (const message of sent) {
      for (const rendered of [message.subject, message.text, message.html!]) {
        expect(rendered).toContain("+971509876543");
        expect(rendered).toContain("13 September 1995");
        expect(rendered).toContain("age: 31");
        expect(rendered).not.toContain("Layla");
      }
    }
  });

  it("calculates age before the birthday using the Dubai submission date, with missing attribution blank", async () => {
    await sendWaitlistEmails({ submission: { ...signup, attribution: {} }, submittedAt: "2026-09-12T19:59:00Z" }, adapter);
    expect(valuesFor("waitlist_confirmation").age).toBe("30");
    expect(valuesFor("waitlist_signup_notification")).toMatchObject({ source: "", campaign: "", utm_source: "", referrer: "" });
  });

  it("renders enquiry names, phone and message from the actual submission", async () => {
    await sendContactEmails({ ...customer, message: "Please call me about a visit." }, adapter);
    for (const key of ["contact_acknowledgement", "contact_notification"] as const) {
      expect(valuesFor(key)).toMatchObject({ first_name: "Amina", last_name: "Khalil", full_name: "Amina Khalil", phone: "+971509876543", phone_country: "AE" });
      expect(variableCatalogue(key)).not.toContain("age");
      expect(variableCatalogue(key)).not.toContain("amount");
    }
    expect(sent.every((message) => message.text.includes("Please call me about a visit."))).toBe(true);
  });

  it("leaves an omitted enquiry phone and its country blank instead of sending example data", async () => {
    await sendContactEmails({ ...customer, phone: { e164: "", countryIso2: "AE" }, message: "A private visit enquiry." }, adapter);
    for (const key of ["contact_acknowledgement", "contact_notification"] as const) {
      expect(valuesFor(key)).toMatchObject({ phone: "", phone_country: "" });
    }
    expect(sent.every((message) => !message.text.includes("+971"))).toBe(true);
  });
});
