import { authoredDocumentSchema } from "@/lib/validation/message-document";
import { describe, expect, it } from "vitest";
import { cmsPage } from "@/lib/config/cms/registry";
import { withImageAltFields } from "@/lib/config/cms/alt-fields";
import { resolveConceptContent } from "@/lib/config/cms/concept-content";
import { resolveSuitesContent } from "@/lib/config/cms/suites-content";
import { resolveLegalContent } from "@/lib/config/cms/legal-content";
import { resolvePublicUrls, routePublicUrl } from "@/lib/config/cms/public-urls";
import { parseWaitlistFilters } from "@/lib/config/waitlist-filters";

describe("[§CMS functions]", () => {
  it("keeps image-description fields unique and connects edits to rendering", () => {
    const page = cmsPage("concept")!;
    expect(withImageAltFields(page)).toEqual(page);
    expect(resolveConceptContent({ hero: { imageAlt: "A private wellness suite" } }).hero.imageAlt).toBe("A private wellness suite");
    expect(resolveConceptContent({ chapters: { items: [{ title: "Privacy", image: "/a.webp", imageAlt: "Private entrance" }] } }).chapters[0].imageAlt).toBe("Private entrance");
    expect(resolveSuitesContent({ cards: { items: [{ title: "Heat", imageAlt: "Finnish sauna" }] } }).cards[0].imageAlt).toBe("Finnish sauna");
  });
  it("renders all legal paragraphs with their published version", () => {
    const content = resolveLegalContent({ publication: { version: "2.0" }, "legal-terms": { body: "First approved paragraph.\n\nSecond approved paragraph." } });
    expect(content.version).toBe("2.0");
    expect(content.documents[0].paragraphs).toEqual(["First approved paragraph.", "Second approved paragraph."]);
    expect(content.documents).toHaveLength(4);
  });
  it("routes custom paths without loops and resolves redirects to the final path", () => {
    const stored = { pages: { suites: "/private-suites" }, redirects: { items: [{ from: "/launch", target: "/suites" }] } };
    expect(routePublicUrl("/suites", stored)).toEqual({ kind: "redirect", path: "/private-suites" });
    expect(routePublicUrl("/private-suites", stored)).toEqual({ kind: "rewrite", path: "/suites" });
    expect(routePublicUrl("/launch", stored)).toEqual({ kind: "redirect", path: "/private-suites" });
    expect(routePublicUrl("/contact", stored)).toBeNull();
  });
  it("refuses unsafe URLs, collisions and protected console or payment routes", () => {
    for (const path of ["//evil.example", "/manage", "/api/export", "/suites?x=1", "/faq", "/book", "/private%2fsuite"])
      expect(resolvePublicUrls({ pages: { suites: path } }).error).not.toBeNull();
  });
  it("retains separately authored WhatsApp wording without changing email delivery", () => {
    const document = authoredDocumentSchema.parse({ subject: [], preheader: [], blocks: [],
      whatsapp: [{ kind: "text", text: "Your booking is confirmed.", bold: false, italic: false, underline: false }],
      delivery: { channel: "email", isActive: true, timingMinutes: null } });
    expect(document.whatsapp?.[0]).toMatchObject({ text: "Your booking is confirmed." });
    expect(document.delivery?.channel).toBe("email");
  });
  it("uses identical filters for the screen and export and defaults to all entries", () => {
    expect(parseWaitlistFilters(new URLSearchParams()).scope).toBe("all");
    expect(parseWaitlistFilters(new URLSearchParams("scope=archived&marketing=withdrawn&from=2026-09-01&to=2026-02-30&source=Email&campaign=launch")))
      .toEqual({ scope: "archived", marketing: "withdrawn", from: "2026-09-01", to: undefined, source: "Email", campaign: "launch" });
  });
});
