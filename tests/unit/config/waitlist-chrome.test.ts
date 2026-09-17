import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HomeFooter } from "@/components/marketing/home/home-footer";
import { SiteNav } from "@/components/marketing/home/home-nav";
import { resolveFooterContent, resolveNavbarContent } from "@/lib/config/cms/site-chrome-content";

vi.mock("next/navigation", () => ({ usePathname: () => "/legal" }));

describe("Legal page navigation variants [CLIENT 15 September 2026]", () => {
  const navbar = resolveNavbarContent(null);
  const footer = resolveFooterContent(null);

  it("keeps the original navigation and Explore links as the default variant", () => {
    const navHtml = renderToStaticMarkup(createElement(SiteNav, { content: navbar, bookHref: "/book" }));
    const footerHtml = renderToStaticMarkup(createElement(HomeFooter, { content: footer, links: navbar.links }));

    expect(navHtml).toContain('href="/"');
    expect(navHtml).toContain('href="/book"');
    expect(navHtml).toContain("Book now");
    expect(footerHtml).toContain('aria-label="Explore"');
    for (const link of navbar.links) {
      expect(navHtml).toContain(`href="${link.href}"`);
      expect(footerHtml).toContain(`href="${link.href}"`);
    }
    expect(navHtml + footerHtml).not.toContain("Waitlist open");
  });

  it("replaces launch navigation without overwriting the published CMS content", () => {
    const savedNavbar = structuredClone(navbar);
    const savedFooter = structuredClone(footer);
    const navHtml = renderToStaticMarkup(createElement(SiteNav, { content: navbar, bookHref: "/book", variant: "waitlist" }));
    const footerHtml = renderToStaticMarkup(createElement(HomeFooter, { content: footer, links: navbar.links, variant: "waitlist" }));

    expect(navHtml).toContain("Open waitlist");
    expect(navHtml).toContain('href="/waitlist"');
    expect(footerHtml).toContain('href="/waitlist"');
    expect(footerHtml).toContain('href="/legal"');
    expect(footerHtml).toContain("Cookie settings");
    expect(footerHtml).not.toContain('aria-label="Explore"');
    expect(navHtml + footerHtml).not.toContain('href="/"');
    for (const link of navbar.links) expect(navHtml + footerHtml).not.toContain(`href="${link.href}"`);
    expect(navbar).toEqual(savedNavbar);
    expect(footer).toEqual(savedFooter);
  });
});
