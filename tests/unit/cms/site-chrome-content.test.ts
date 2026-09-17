import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  resolveFooterContent,
  resolveNavbarContent,
} from "@/lib/config/cms/site-chrome-content";
import { SOCIAL_ICON_OPTIONS } from "@/lib/config/social-icons";
import { DEFAULT_SOCIAL_URLS } from "@/lib/config/social-links";
import { FOOTER_CMS_PAGE } from "@/lib/config/cms/pages/site-chrome";
import { FOOTER_CONTENT, NAVBAR_CONTENT } from "@/lib/config/site-chrome";

describe("published navigation bar — §5.1, §4.3", () => {
  it("falls back to the built-in menu when nothing is published", () => {
    const content = resolveNavbarContent(null);

    expect(content.links).toHaveLength(NAVBAR_CONTENT.links.length);
    expect(content.links[0]?.label).toBe(NAVBAR_CONTENT.links[0]?.label);
    expect(content.bookLabel).toBe(NAVBAR_CONTENT.bookLabel);
  });

  it("lets an editor rename and reorder the menu", () => {
    const content = resolveNavbarContent({
      links: {
        items: [
          { label: "Get in touch", page: "/contact" },
          { label: "The concept", page: "/concept" },
        ],
      },
    });

    expect(content.links).toEqual([
      { label: "Get in touch", href: "/contact" },
      { label: "The concept", href: "/concept" },
    ]);
  });

  it("refuses a destination that is not a page of this site", () => {
    const content = resolveNavbarContent({
      links: {
        items: [
          { label: "Elsewhere", page: "https://example.com" },
          { label: "Contact", page: "/contact" },
        ],
      },
    });

    expect(content.links).toEqual([{ label: "Contact", href: "/contact" }]);
  });

  it("keeps the built-in menu rather than leaving the header empty", () => {
    const emptied = resolveNavbarContent({ links: { items: [] } });
    const invalid = resolveNavbarContent({
      links: { items: [{ label: "", page: "/contact" }] },
    });

    expect(emptied.links).toHaveLength(NAVBAR_CONTENT.links.length);
    expect(invalid.links).toHaveLength(NAVBAR_CONTENT.links.length);
  });

  it("never leaves a menu label empty", () => {
    const content = resolveNavbarContent({
      actions: {
        bookLabel: "   ",
        openMenuLabel: "",
        closeMenuLabel: "",
        logoTopLabel: "",
        logoHomeLabel: "",
        primaryNavLabel: "",
      },
    });

    for (const [key, value] of Object.entries(content)) {
      if (["links", "logo", "favicon"].includes(key)) continue;
      expect(String(value).length, `${key} resolved empty`).toBeGreaterThan(0);
    }
  });
});

describe("published footer — §5.1, §4.3", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveFooterContent(null);

    expect(content.tagline).toBe(FOOTER_CONTENT.tagline);
    expect(content.localityLine).toBe(FOOTER_CONTENT.localityLine);
  });

  it("never leaves a footer heading or label empty", () => {
    const blanked = Object.fromEntries(
      Object.keys(FOOTER_CONTENT).map((key) => [key, "  "]),
    );
    const content = resolveFooterContent({
      brand: blanked,
      columns: blanked,
      base: blanked,
    });

    for (const [key, value] of Object.entries(content)) {
      if (typeof value === "string") expect(value.length, `${key} resolved empty`).toBeGreaterThan(0);
    }
  });

  it("lets an editor rewrite a column heading", () => {
    const content = resolveFooterContent({ columns: { exploreHeading: "Pages" } });

    expect(content.exploreHeading).toBe("Pages");
    expect(content.companyHeading).toBe(FOOTER_CONTENT.companyHeading);
  });
});

describe("the loading splash stays in code — §4.1", () => {
  it("keeps every loading screen free of a database read", () => {
    for (const route of [
      "src/app/(site)/loading.tsx",
      "src/app/(site)/concept/loading.tsx",
      "src/app/(site)/suites/loading.tsx",
      "src/app/(site)/book/loading.tsx",
      "src/app/(site)/faq/loading.tsx",
      "src/app/(site)/contact/loading.tsx",
      "src/components/marketing/site-startup-loader.tsx",
    ]) {
      const source = readFileSync(route, "utf8");
      expect(source.includes("getSiteChrome"), `${route} reads the CMS`).toBe(false);
    }
  });

  it("leaves the site layout free of any CMS read, so static routes stay static", () => {
    const layout = readFileSync("src/app/(site)/layout.tsx", "utf8");

    expect(layout.includes("getSiteChrome")).toBe(false);
    expect(layout.includes("Slot")).toBe(false);
  });
});

describe("chrome media and contact controls", () => {
  it("derives accessible labels from the selected icon, ignoring legacy names", () => {
    const footer = resolveFooterContent({ social: { socialLinks: [
      { icon: "tiktok", label: "Watch WellPlace", href: "https://www.tiktok.com/@wellplace" },
      { icon: "website", label: "Our Instagram", href: "https://instagram.com/wellplace" },
    ] } });
    expect(footer.socialLinks).toEqual([
      { icon: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@wellplace" },
      { icon: "website", label: "Website / other profile", href: "https://instagram.com/wellplace" },
    ]);
  });

  it("uses the email defaults and respects an explicitly empty profile list — CLIENT", () => {
    expect(resolveFooterContent(null).socialLinks).toEqual([
      { icon: "instagram", label: "Instagram", href: DEFAULT_SOCIAL_URLS.instagram },
      { icon: "tiktok", label: "TikTok", href: DEFAULT_SOCIAL_URLS.tiktok },
    ]);
    expect(resolveFooterContent({ social: { socialLinks: [] } }).socialLinks).toEqual([]);
  });

  it("supports every icon with only a URL and removes the name field — CLIENT", () => {
    for (const option of SOCIAL_ICON_OPTIONS) {
      const footer = resolveFooterContent({ social: { socialLinks: [
        { icon: option.value, href: "https://example.test/profile" },
      ] } });
      expect(footer.socialLinks).toEqual([
        { icon: option.value, label: option.label, href: "https://example.test/profile" },
      ]);
    }
    const profiles = FOOTER_CMS_PAGE.sections.find((section) => section.key === "social")
      ?.fields.find((field) => field.key === "socialLinks");
    expect(profiles?.kind).toBe("repeater");
    if (profiles?.kind === "repeater") {
      expect(profiles.fields.map((field) => field.key)).toEqual(["icon", "href"]);
    }
  });

  it("uses safe fallback icons and never mistakes lookalike domains for a social platform", () => {
    const footer = resolveFooterContent({ social: { socialLinks: [
      { icon: "unrecognised", label: "Profile", href: "https://instagram.com/wellplace" },
      { label: "Other", href: "https://instagram.com.example.test/wellplace" },
      { label: "TikTok", href: "https://www.tiktok.com/@wellplace" },
    ] } });
    expect(footer.socialLinks.map((link) => link.icon)).toEqual(["website", "website", "tiktok"]);
  });

  it("filters unsafe social profiles", () => {
    const footer = resolveFooterContent({ columns: { email: "bad\r\nBcc: attacker@example.test" }, social: { socialLinks: [{ label: "Instagram", href: "https://instagram.com/wellplace" }, { label: "Unsafe", href: "javascript:alert(1)" }] } });
    expect(footer.socialLinks).toEqual([{ label: "Instagram", href: "https://instagram.com/wellplace", icon: "instagram" }]);
  });
});
