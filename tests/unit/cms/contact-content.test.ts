import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveContactContent } from "@/lib/config/cms/contact-content";
import { CONTACT_CMS_PAGE } from "@/lib/config/cms/registry";
import { CONTACT_PAGE_CONTENT } from "@/lib/config/contact";

describe("published contact page — §5.1, §4.3", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveContactContent(null);

    expect(content.hero.title).toBe(CONTACT_PAGE_CONTENT.hero.title);
    expect(content.form.submitLabel).toBe(CONTACT_PAGE_CONTENT.form.submitLabel);
    expect(content.methods.heading).toBe(CONTACT_PAGE_CONTENT.methods.heading);
  });

  it("keeps the authored description for the hero image", () => {
    expect(resolveContactContent(null).hero.imageAlt).toBe(
      CONTACT_PAGE_CONTENT.hero.imageAlt,
    );
  });

  it("never leaves a form label or a toast empty, whatever an editor clears", () => {
    const blanked = Object.fromEntries(
      Object.keys(CONTACT_PAGE_CONTENT.form).map((key) => [key, "   "]),
    );
    const content = resolveContactContent({ form: blanked });

    for (const [key, value] of Object.entries(content.form)) {
      expect(value.length, `form.${key} resolved empty`).toBeGreaterThan(0);
    }
    expect(content.form.submitLabel).toBe(CONTACT_PAGE_CONTENT.form.submitLabel);
  });

  it("never leaves a contact option label empty", () => {
    const blanked = Object.fromEntries(
      Object.keys(CONTACT_PAGE_CONTENT.methods).map((key) => [key, ""]),
    );
    const content = resolveContactContent({ methods: blanked });

    for (const [key, value] of Object.entries(content.methods)) {
      expect(value.length, `methods.${key} resolved empty`).toBeGreaterThan(0);
    }
  });

  it("lets an editor rewrite a label and a toast", () => {
    const content = resolveContactContent({
      form: { submitLabel: "Send it", sentTitle: "On its way" },
      methods: { closedLabel: "Rest day" },
    });

    expect(content.form.submitLabel).toBe("Send it");
    expect(content.form.sentTitle).toBe("On its way");
    expect(content.methods.closedLabel).toBe("Rest day");
    expect(content.form.pendingLabel).toBe(CONTACT_PAGE_CONTENT.form.pendingLabel);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveContactContent({
      hero: { title: 4 },
      form: { submitLabel: [] },
    });

    expect(content.hero.title).toBe(CONTACT_PAGE_CONTENT.hero.title);
    expect(content.form.submitLabel).toBe(CONTACT_PAGE_CONTENT.form.submitLabel);
  });
});

describe("contact values stay in settings — §10.2, R-05", () => {
  it("offers no field that would duplicate a contact setting", () => {
    const keys = CONTACT_CMS_PAGE.sections.flatMap((section) =>
      section.fields.map((field) => field.key),
    );

    expect(keys).not.toContain("email");
    expect(keys).not.toContain("whatsapp");
    expect(keys).not.toContain("hours");
    expect(keys).not.toContain("address");
  });

  it("still reads the address, email and hours from outside the CMS", () => {
    const page = readFileSync("src/app/(site)/contact/page.tsx", "utf8");

    expect(page.includes('getSetting(settings, "contact.email")')).toBe(true);
    expect(page.includes("wa.me")).toBe(false);
    expect(page.includes("publicOpeningHours(settings)")).toBe(true);
    expect(page.includes("VENUE_ADDRESS_LINES")).toBe(true);
  });
});
