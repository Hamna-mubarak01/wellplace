import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { defaultDocument, sampleValues } from "@/lib/config/message-documents";
import { DEFAULT_FOOTER_DESIGN, FOOTER_PLATFORMS, MESSAGE_FOOTER_LIMITS, footerIconPath } from "@/lib/config/message-footer";
import { editableFooterDesign, messageEmailFrame } from "@/lib/config/message-email-frame";
import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import { authoredEmail } from "@/lib/messaging/templates/authored";
import { renderEmail } from "@/lib/messaging/templates/layout";
import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import { authoredDocumentSchema } from "@/lib/validation/message-document";
import { invoiceDocument, invoiceEmail } from "@/lib/messaging/templates/invoice";
import { sampleInvoice } from "../support/invoice";

const design: EmailFooterDesign = {
  ...DEFAULT_FOOTER_DESIGN, label: "Stay connected", iconStyle: "coloured", align: "left", divider: true,
  links: [
    { id: "web", icon: "website", label: "Our website", href: "https://wellplace.example/?a=1&b=2", enabled: true },
    { id: "email", icon: "email", label: "Email the team", href: "mailto:hello@wellplace.example", enabled: true },
    { id: "phone", icon: "phone", label: "Call us", href: "tel:+971501234567", enabled: true },
    { id: "off", icon: "instagram", label: "Hidden Instagram", href: "", enabled: false },
  ],
};
const key = "waitlist_confirmation";

function render(footerDesign = design, branding = true) {
  return renderEmail({ subject: "Review", assetBaseUrl: "https://wellplace.example", blocks: [], footerLines: ["WellPlace · Dubai"], footerDesign, branding });
}

describe("[OUR CHOICE; owner request 12 September 2026] Rich email footers", () => {
  it("round-trips the design and keeps old text-only documents valid", () => {
    expect(authoredDocumentSchema.parse({ ...defaultDocument(key), footerDesign: design }).footerDesign).toEqual(design);
    expect(authoredDocumentSchema.safeParse(defaultDocument(key)).success).toBe(true);
  });

  it("renders safe ordered social/contact links, matching PNG icons, alignment and plain-text alternatives", () => {
    const result = render();
    expect(result.html).toContain('align="left"');
    expect(result.html).toContain('href="https://wellplace.example/?a=1&amp;b=2"');
    expect(result.html).toContain('href="mailto:hello@wellplace.example"');
    expect(result.html).toContain('href="tel:+971501234567"');
    expect(result.html).toContain('/email/social/website-coloured.png');
    expect(result.html).toContain('alt="Our website"');
    expect(result.html).not.toContain("Hidden Instagram");
    expect(result.text.indexOf("Our website")).toBeLessThan(result.text.indexOf("Email the team"));
    expect(result.text).toContain("Call us: tel:+971501234567");
    expect(result.html).not.toBe(render({ ...design, divider: false }).html);
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>", "http://example.com", "https://user:pass@example.com", "mailto:a@b.com\r\nBcc:x@y.com", "//example.com"])("rejects unsafe links at validation and rendering: %s", (href) => {
    const unsafe = { ...design, links: [{ ...design.links[0], href }] };
    expect(messageFooterDesignSchema.safeParse(unsafe).success).toBe(false);
    const result = render(unsafe);
    expect(result.html).not.toContain("website-coloured.png");
    expect(result.text).not.toContain(href);
  });

  it("escapes labels and rejects missing enabled links, duplicate IDs and excess items", () => {
    expect(render({ ...design, label: '<script>alert("x")</script>', links: [{ ...design.links[0], label: '" onclick="alert(1)' }] }).html).toContain("&lt;script&gt;");
    expect(messageFooterDesignSchema.safeParse({ ...design, links: [{ ...design.links[0], href: "" }] }).success).toBe(false);
    expect(messageFooterDesignSchema.safeParse({ ...design, links: [design.links[0], design.links[0]] }).success).toBe(false);
    expect(messageFooterDesignSchema.safeParse({ ...design, links: Array.from({ length: MESSAGE_FOOTER_LIMITS.linksMax + 1 }, (_, index) => ({ ...design.links[0], id: String(index) })) }).success).toBe(false);
  });

  it("uses the published individual design before bulk defaults and honours an explicitly empty design", () => {
    const request = { key, stored: { ...defaultDocument(key)!, footerDesign: DEFAULT_FOOTER_DESIGN }, footerDesign: design, values: sampleValues(key) } as const;
    expect(authoredEmail(request)!.html).not.toContain("Stay connected");
    expect(authoredEmail({ ...request, stored: null })!.html).toContain("Stay connected");
    expect(render(design, false).html).not.toContain("Stay connected");
    expect(render(design, false).text).not.toContain("Call us");
  });

  it("preserves current social URLs when opening a legacy footer", () => {
    const frame = messageEmailFrame(key, { assetBaseUrl: "", instagramUrl: "https://instagram.com/wellplace", tiktokUrl: "https://tiktok.com/@wellplace" });
    expect(editableFooterDesign(frame).links.map((link) => link.href)).toEqual(["https://instagram.com/wellplace", "https://tiktok.com/@wellplace"]);
    expect(editableFooterDesign({ ...frame, footerDesign: DEFAULT_FOOTER_DESIGN }).links).toEqual([]);
  });

  it("includes rich footers in coded invoice email without changing invoice attachments", () => {
    const invoice = invoiceDocument(sampleInvoice());
    const recipient = { email: "guest@example.test", firstName: "Guest" };
    const before = invoiceEmail(invoice, recipient);
    const after = invoiceEmail(invoice, recipient, { footerDesign: design });
    expect(after.html).toContain("website-coloured.png");
    expect(after.attachments).toEqual(before.attachments);
  });

  it("has a local email-safe PNG for every selectable icon and style", () => {
    for (const platform of FOOTER_PLATFORMS) for (const style of ["brand", "coloured", "monochrome"] as const) {
      expect(existsSync(`public${footerIconPath(platform.value, style)}`)).toBe(true);
    }
  });
});
