import { BOOKING_RENDERINGS } from "@/lib/config/booking-media";
import { CONCEPT_CHAPTERS, CONCEPT_PAGE_CONTENT } from "@/lib/config/concept";
import { CONTACT_PAGE_CONTENT } from "@/lib/config/contact";
import { HOME_PAGE_CONTENT } from "@/lib/config/home";
import { SUITES_PAGE_CONTENT, SUITE_STORY_CARDS } from "@/lib/config/suites";

export type AltScope = "home.suite" | "home.gallery" | "concept.hero" | "concept.chapters"
  | "suites.hero"
  | "suites.cards"
  | "contact.hero"
  | "booking.addons"
  | "booking.gallery";

interface Described {
  readonly image: string;
  readonly alt?: string;
  readonly imageAlt?: string;
}

function mapFrom(source: readonly Described[]): ReadonlyMap<string, string> {
  const entries = source
    .map((entry): [string, string] => [
      entry.image.trim(),
      (entry.alt ?? entry.imageAlt ?? "").trim(),
    ])
    .filter(([src, alt]) => src.length > 0 && alt.length > 0);

  return new Map(entries);
}

function mapFromSrc(
  source: readonly { readonly src: string; readonly alt: string }[],
): ReadonlyMap<string, string> {
  return mapFrom(source.map(({ src, alt }) => ({ image: src, alt })));
}

const SCOPES: Record<AltScope, ReadonlyMap<string, string>> = {
  "home.suite": mapFrom(HOME_PAGE_CONTENT.suite.views),
  "home.gallery": mapFrom(HOME_PAGE_CONTENT.gallery.shots),
  "concept.hero": mapFrom([CONCEPT_PAGE_CONTENT.hero]),
  "concept.chapters": mapFrom(CONCEPT_CHAPTERS),
  "suites.hero": mapFrom([SUITES_PAGE_CONTENT.hero]),
  "suites.cards": mapFrom(SUITE_STORY_CARDS),
  "contact.hero": mapFrom([CONTACT_PAGE_CONTENT.hero]),
  "booking.addons": mapFrom([]),
  "booking.gallery": mapFromSrc(BOOKING_RENDERINGS),
};

export function describeImage(
  scope: AltScope,
  src: string,
  parts: readonly string[],
  position: string,
): string {
  const authored = SCOPES[scope].get(src.trim());
  if (authored) return authored;

  const composed = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return composed ? `${composed}, ${position.toLowerCase()}` : position;
}
