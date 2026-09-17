import { describe, expect, it } from "vitest";

import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_BY_SLUG,
  LEGAL_SLUGS,
  LEGAL_TEXTS_VERSION,
  findLegalDocument,
  isLegalSlug,
  legalHref,
} from "@/lib/config/legal";
import { LEGAL_ENTITY_PUBLIC } from "@/lib/config/entity";

function documentText(slug: (typeof LEGAL_SLUGS)[number]): string {
  const document = findLegalDocument(slug);
  if (!document) throw new Error(`no legal document for ${slug}`);
  return [document.title, document.lastUpdated ?? "", ...document.paragraphs].join("\n");
}

describe("the four legal documents [§6.3, CONFIRMED v1.3]", () => {
  it("ships exactly the four slugs, once each", () => {
    expect(LEGAL_DOCUMENTS.map((d) => d.slug)).toEqual([...LEGAL_SLUGS]);
    expect(new Set(LEGAL_DOCUMENTS.map((d) => d.slug)).size).toBe(LEGAL_SLUGS.length);
    expect(LEGAL_SLUGS).toHaveLength(4);
  });

  it("keeps the client's numbering — ordinals 1 to 4, no gap and no duplicate", () => {
    const ordinals = LEGAL_DOCUMENTS.map((d) => d.ordinal).sort((a, b) => a - b);
    expect(ordinals).toEqual([1, 2, 3, 4]);
  });

  it("every document has a title and at least one non-empty paragraph", () => {
    for (const document of LEGAL_DOCUMENTS) {
      expect(document.title.trim(), `${document.slug} has no title`).not.toBe("");
      expect(document.paragraphs.length, `${document.slug} has no paragraphs`).toBeGreaterThan(0);
      for (const paragraph of document.paragraphs) {
        expect(paragraph.trim(), `${document.slug} has an empty paragraph`).not.toBe("");
      }
    }
  });

  it("is stamped with one version across all four", () => {
    expect(LEGAL_TEXTS_VERSION).toBe("1.3");
  });
});

describe("findLegalDocument", () => {
  it("returns the right document for each slug", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(findLegalDocument(slug)?.slug).toBe(slug);
    }
  });

  it("returns undefined for a slug that does not exist, rather than throwing", () => {
    for (const unknown of ["health-risks", "house-rules", "terms", "legal-terms ", ""]) {
      expect(findLegalDocument(unknown), unknown).toBeUndefined();
    }
  });

  it("legalHref points at the document's section of the combined page [CLIENT 31 Aug 2026]", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(legalHref(slug)).toBe(`/legal#${slug}`);
    }
  });
});

describe("the Privacy Policy carries the facts other rules depend on", () => {
  const privacy = documentText("privacy-policy");

  it("names the demo operator as the controller", () => {
    expect(privacy).toContain(LEGAL_ENTITY_PUBLIC);
  });

  it("says plainly that it is demo copy, so nobody mistakes it for a real notice", () => {
    expect(privacy).toContain("sample copy for a demo application");
  });

  it("gives privacy@wellplace.example as the contact", () => {
    expect(privacy).toContain("privacy@wellplace.example");
  });

  it("still states 24 months of retention, which is what INV-28 and R-46 enforce", () => {
    expect(privacy).toMatch(/24 months/);
    expect(privacy).toMatch(/24 months from the last interaction/);
  });

  it.each([
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
  ])("does not resolve the inherited property %s as a document", (key) => {
    expect(findLegalDocument(key)).toBeUndefined();
    expect(isLegalSlug(key)).toBe(false);
  });

  it("inherits nothing from Object.prototype", () => {
    expect(Object.getPrototypeOf(LEGAL_DOCUMENTS_BY_SLUG)).toBeNull();
  });
});
