import { beforeEach, describe, expect, it } from "vitest";

import { resetEmailConfigCache } from "@/lib/config/email";
import {
  SYSTEM_MESSAGES,
  defaultDocument,
  sampleValues,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import { text, variable, type AuthoredDocument } from "@/lib/domain/email/document";
import { authoredEmail, resolveDocument } from "@/lib/messaging/templates/authored";

beforeEach(() => {
  resetEmailConfigCache();
});

function send(key: SystemMessageKey, stored: AuthoredDocument | null = null) {
  return authoredEmail({ key, stored, values: sampleValues(key) });
}

const CONNECTED_WITH_DEFAULT = SYSTEM_MESSAGES.filter(
  (spec) => spec.connected && defaultDocument(spec.key) !== null,
).map((spec) => spec.key);

const GUEST_KEYS = SYSTEM_MESSAGES.filter(
  (spec) => spec.audience === "guest" && defaultDocument(spec.key) !== null,
).map((spec) => spec.key);

const STAFF_KEYS = SYSTEM_MESSAGES.filter(
  (spec) => spec.audience === "staff" && defaultDocument(spec.key) !== null,
).map((spec) => spec.key);

describe("§12 — an email is built from the wording a manager published", () => {
  it.each(CONNECTED_WITH_DEFAULT)("builds a sendable message for %s", (key) => {
    const message = send(key);

    expect(message).not.toBeNull();
    expect(message?.subject.trim().length).toBeGreaterThan(0);
    expect(message?.html?.length ?? 0).toBeGreaterThan(0);
    expect(message?.text?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(CONNECTED_WITH_DEFAULT)("leaves no unresolved token in %s", (key) => {
    const message = send(key);

    expect(message?.subject).not.toContain("{{");
    expect(message?.html).not.toContain("{{");
    expect(message?.text).not.toContain("{{");
  });

  it("falls back to the built-in wording when nothing is published", () => {
    expect(resolveDocument("waitlist_confirmation", null)).toEqual(
      defaultDocument("waitlist_confirmation"),
    );
  });

  it("falls back to the built-in wording when the stored document has no blocks", () => {
    const empty: AuthoredDocument = { subject: [text("Hi")], preheader: [], blocks: [] };

    expect(resolveDocument("waitlist_confirmation", empty)).toEqual(
      defaultDocument("waitlist_confirmation"),
    );
  });

  it("prefers the published wording over the built-in wording", () => {
    const stored: AuthoredDocument = {
      subject: [text("A new subject for "), variable("first_name")],
      preheader: [],
      blocks: [{ kind: "heading", id: "h", content: [text("Rewritten")] }],
    };

    const message = authoredEmail({
      key: "waitlist_confirmation",
      stored,
      values: sampleValues("waitlist_confirmation"),
    });

    expect(message?.subject).toBe("A new subject for Layla");
    expect(message?.html).toContain("Rewritten");
  });

  it("returns nothing for a template with no wording of any kind", () => {
    expect(send("payment_received")).toBeNull();
  });
});

describe("§12 — who the message is addressed to", () => {
  it.each(GUEST_KEYS)("sends %s to the guest's own address", (key) => {
    expect(send(key)?.to).toBe(sampleValues(key).email);
  });

  it.each(STAFF_KEYS)("sends %s to the operations mailbox", (key) => {
    expect(send(key)?.to).toEqual(["hello@wellplace.example"]);
  });

  it.each(GUEST_KEYS)("lets the caller name the recipient for %s", (key) => {
    const message = authoredEmail({
      key,
      stored: null,
      values: sampleValues(key),
      to: "someone@example.com",
    });

    expect(message?.to).toBe("someone@example.com");
  });

  it("sends nothing when a guest message has no address to send to", () => {
    const message = authoredEmail({
      key: "waitlist_confirmation",
      stored: null,
      values: { first_name: "Layla" },
    });

    expect(message).toBeNull();
  });

  it.each(GUEST_KEYS)("replies to the guest address for %s", (key) => {
    expect(send(key)?.replyTo).toBe("hello@wellplace.example");
  });

  it.each(GUEST_KEYS)("sends %s under the guest sender name", (key) => {
    expect(send(key)?.from).toContain("WellPlace");
  });

  it.each(STAFF_KEYS)("sends %s under the operations sender name", (key) => {
    expect(send(key)?.from).toContain("WellPlace notifications");
  });
});

describe("§12 — a booking message is never treated as marketing", () => {
  it.each(CONNECTED_WITH_DEFAULT)("marks %s transactional", (key) => {
    expect(send(key)?.kind).toBe("transactional");
  });
});

describe("§12 — the rendered shell", () => {
  it("carries the WellPlace wordmark", () => {
    expect(send("waitlist_confirmation")?.html).toContain("wordmark-dark-email.png");
  });

  it("carries the waitlist footer on the waitlist welcome", () => {
    expect(send("waitlist_confirmation")?.html).toContain("you joined the WellPlace waitlist");
  });

  it("carries the staff-only footer on a console invitation", () => {
    expect(send("staff_invitation")?.html).toContain("sent to staff only");
  });

  it("shows social links on the waitlist welcome", () => {
    expect(send("waitlist_confirmation")?.html).toContain("Follow the WellPlace journey");
  });

  it("shows no social links on a console invitation", () => {
    expect(send("staff_invitation")?.html).not.toContain("Follow the WellPlace journey");
  });

  it("hides the preheader when the wording leaves it blank", () => {
    expect(send("waitlist_signup_notification")?.html).not.toContain("mso-hide:all");
  });

  it("includes the preheader when the wording supplies one", () => {
    expect(send("waitlist_confirmation")?.html).toContain("mso-hide:all");
  });
});

describe("§13 — author wording cannot become markup", () => {
  it("escapes a script tag written into the subject", () => {
    const stored: AuthoredDocument = {
      subject: [text("<script>alert(1)</script>")],
      preheader: [],
      blocks: [{ kind: "heading", id: "h", content: [text("<img onerror=x>")] }],
    };

    const message = authoredEmail({
      key: "waitlist_confirmation",
      stored,
      values: sampleValues("waitlist_confirmation"),
    });

    expect(message?.html).not.toContain("<script>");
    expect(message?.html).not.toContain("<img onerror");
    expect(message?.html).toContain("&lt;script&gt;");
  });

  it("drops a link whose address could never be sent", () => {
    const stored: AuthoredDocument = {
      subject: [text("Subject")],
      preheader: [],
      blocks: [
        {
          kind: "text",
          id: "t",
          content: [{ kind: "link", href: "javascript:alert(1)", label: [text("Open")] }],
          align: "left",
          size: "normal",
        },
      ],
    };

    const message = authoredEmail({
      key: "waitlist_confirmation",
      stored,
      values: sampleValues("waitlist_confirmation"),
    });

    expect(message?.html).toContain("Open");
    expect(message?.html).not.toContain("javascript:");
    expect(message?.text).not.toContain("javascript:");
  });
});
