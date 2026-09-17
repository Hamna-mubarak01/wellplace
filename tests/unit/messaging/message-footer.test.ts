import { describe, expect, it } from "vitest";
import { defaultDocument, sampleValues, MESSAGE_DOCUMENT_LIMITS } from "@/lib/config/message-documents";
import { footerFor } from "@/lib/config/message-email-frame";
import { authoredEmail } from "@/lib/messaging/templates/authored";
import { authoredDocumentSchema, messageFooterSchema } from "@/lib/validation/message-document";
import { invoiceDocument, invoiceEmail } from "@/lib/messaging/templates/invoice";
import { sampleInvoice } from "../support/invoice";

const key = "waitlist_confirmation";
const document = defaultDocument(key)!;

describe("[OUR CHOICE; owner request 12 September 2026] Editable email footer", () => {
  it("round-trips footer text through document validation and leaves old documents readable", () => {
    expect(authoredDocumentSchema.parse({ ...document, footer: "New footer\nContact us" }).footer).toBe("New footer\nContact us");
    expect(authoredDocumentSchema.safeParse(document).success).toBe(true);
    expect(messageFooterSchema.safeParse("a".repeat(MESSAGE_DOCUMENT_LIMITS.textMax + 1)).success).toBe(false);
  });

  it("uses individual wording before the footer applied to all, in HTML and plain text", () => {
    const message = authoredEmail({ key, stored: { ...document, footer: "Individual footer\nSecond line" }, footer: "All emails footer", values: sampleValues(key) })!;
    expect(message.text).toMatch(/Individual footer\s+Second line/);
    expect(message.html).toContain("Individual footer");
    expect(message.html).not.toContain("All emails footer");
    expect(message.html).not.toContain(footerFor(key)[0]);
  });

  it("applies a footer to built-in wording without publishing a body", () => {
    const message = authoredEmail({ key, stored: null, footer: "Bulk footer", values: sampleValues(key) })!;
    expect(message.html).toContain("Bulk footer");
    expect(message.text).toContain("Bulk footer");
  });

  it("escapes markup and accepts an explicitly empty footer", () => {
    const message = authoredEmail({ key, stored: { ...document, footer: '<script>alert("x")</script>' }, values: sampleValues(key) })!;
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(footerFor(key, "")).toEqual([]);
    const empty = authoredEmail({ key, stored: { ...document, footer: "" }, footer: "Bulk footer", values: sampleValues(key) })!;
    expect(empty.text).not.toContain("Bulk footer");
    expect(empty.text).not.toContain(footerFor(key)[0]);
  });

  it("respects templates with branding switched off", () => {
    const message = authoredEmail({ key, stored: { ...document, branding: false, footer: "Hidden footer" }, values: sampleValues(key) })!;
    expect(message.text).not.toContain("Hidden footer");
    expect(message.html).not.toContain("Hidden footer");
  });

  it("changes the invoice email footer without altering the invoice attachment", () => {
    const invoice = invoiceDocument(sampleInvoice());
    const recipient = { email: "guest@example.test", firstName: "Guest" };
    const before = invoiceEmail(invoice, recipient);
    const after = invoiceEmail(invoice, recipient, { footer: "Invoice footer" });
    expect(after.text).toContain("Invoice footer");
    expect(after.html).toContain("Invoice footer");
    expect(after.attachments).toEqual(before.attachments);
  });
});
