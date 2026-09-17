import { LEGAL_INDEX_HREF, LEGAL_TEXTS_DATE, LEGAL_TEXTS_VERSION } from "@/lib/config/legal";

export interface TermsSegment {
  readonly text: string;
  readonly href?: string;
}

export const TERMS_SEGMENTS: readonly TermsSegment[] = [
  { text: "I agree to WellPlace's " },
  { text: "Legal, Privacy & Marketing Terms", href: LEGAL_INDEX_HREF },
  { text: "." },
] as const;

export const TERMS_ACCEPTANCE = {
  version: LEGAL_TEXTS_VERSION,

  documentsDate: LEGAL_TEXTS_DATE,

  segments: TERMS_SEGMENTS,

  text: TERMS_SEGMENTS.map((segment) => segment.text).join(""),

  documents: ["legal-terms", "privacy-policy", "marketing-terms"] as const,
} as const;
