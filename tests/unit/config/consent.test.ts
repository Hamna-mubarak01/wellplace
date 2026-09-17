import { describe, expect, it } from "vitest";

import { TERMS_ACCEPTANCE, TERMS_SEGMENTS } from "@/lib/config/consent";
import {
  LEGAL_INDEX_HREF,
  LEGAL_SLUGS,
  LEGAL_TEXTS_DATE,
  LEGAL_TEXTS_VERSION,
} from "@/lib/config/legal";

const APPROVED_SENTENCE = "I agree to WellPlace's Legal, Privacy & Marketing Terms.";

const LINKED_PHRASE = "Legal, Privacy & Marketing Terms";

describe("TERMS_ACCEPTANCE — the one required waitlist checkbox [§5.2, §6.3, CLIENT 31 Aug 2026]", () => {
  it("reads exactly the sentence the client approved, character for character", () => {
    expect(TERMS_ACCEPTANCE.text).toBe(APPROVED_SENTENCE);
  });

  it("uses a plain ASCII apostrophe and a literal ampersand, not typographic ones", () => {
    expect(TERMS_ACCEPTANCE.text).toContain("WellPlace's");
    expect(TERMS_ACCEPTANCE.text).toContain(" & ");
    expect(TERMS_ACCEPTANCE.text).not.toMatch(/[‘’“”＆]/);
  });

  it("joining the segments reproduces the text — the invariant the assembly rests on", () => {
    expect(TERMS_SEGMENTS.map((segment) => segment.text).join("")).toBe(
      TERMS_ACCEPTANCE.text,
    );
    expect(TERMS_ACCEPTANCE.segments.map((segment) => segment.text).join("")).toBe(
      TERMS_ACCEPTANCE.text,
    );
  });

  it("carries exactly one link, over the complete phrase, to the combined legal page [CLIENT]", () => {
    const linked = TERMS_SEGMENTS.filter((segment) => segment.href !== undefined);

    expect(linked).toHaveLength(1);
    expect(linked[0]?.text).toBe(LINKED_PHRASE);
    expect(linked[0]?.href).toBe(LEGAL_INDEX_HREF);
  });

  it("no segment links to a single document any more — one link, not three", () => {
    for (const segment of TERMS_SEGMENTS) {
      for (const slug of LEGAL_SLUGS) {
        expect(segment.href ?? "").not.toBe(`/legal/${slug}`);
      }
    }
  });

  it("names three documents, and all three exist", () => {
    expect(TERMS_ACCEPTANCE.documents).toHaveLength(3);
    for (const slug of TERMS_ACCEPTANCE.documents) {
      expect(LEGAL_SLUGS as readonly string[], `${slug} is not a legal document`).toContain(slug);
    }
    expect(new Set(TERMS_ACCEPTANCE.documents).size).toBe(3);
  });

  it("records the version and the publication date of the texts [§6.3]", () => {
    expect(TERMS_ACCEPTANCE.version).toBe(LEGAL_TEXTS_VERSION);
    expect(TERMS_ACCEPTANCE.documentsDate).toBe(LEGAL_TEXTS_DATE);
  });
});

describe("the optional marketing tick is gone [CLIENT 31 Aug 2026]", () => {
  it("exports no marketing consent constant — this module is the only place it could come back", async () => {
    const exported: Record<string, unknown> = await import("@/lib/config/consent");
    expect(Object.keys(exported)).not.toContain("MARKETING_CONSENT");
  });

  it("the one sentence names the Marketing Terms, which is what makes a second tick unnecessary", () => {
    expect(TERMS_ACCEPTANCE.text).toContain("Marketing Terms");
  });
});
