import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveHomeContent } from "@/lib/config/cms/home-content";
import { resolveBookingContent } from "@/lib/config/cms/book-content";
import { resolveConceptContent } from "@/lib/config/cms/concept-content";
import { resolveContactContent } from "@/lib/config/cms/contact-content";
import { resolveFaqContent } from "@/lib/config/cms/faq-content";
import {
  BOOK_CMS_PAGE,
  CMS_PAGES,
  CONCEPT_CMS_PAGE,
  CONTACT_CMS_PAGE,
  FAQ_CMS_PAGE,
  FOOTER_CMS_PAGE,
  HOME_CMS_PAGE,
  NAVBAR_CMS_PAGE,
  RESERVATION_CMS_PAGE,
  SUITES_CMS_PAGE,
} from "@/lib/config/cms/registry";
import { resolveReservationContent } from "@/lib/config/cms/reservation-content";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { VENUE_ADDRESS_LINES } from "@/lib/config/entity";
import { MARKETING_ROUTES } from "@/lib/config/marketing";
import { organisationJsonLd } from "@/lib/config/seo";
import {
  RESERVATION_CONTENT,
  RESERVATION_PAGES,
  RESERVATION_PLACEMENT_DEFAULTS,
} from "@/lib/config/reservation";

function sourceOf(paths: readonly string[]): string {
  return paths.map((path) => readFileSync(path, "utf8")).join("\n");
}

function orphanTextFields(
  page: CmsPageSpec,
  source: string,
  skipSections: readonly string[],
): string[] {
  const orphans: string[] = [];
  for (const section of page.sections) {
    if (skipSections.includes(section.key)) continue;
    for (const field of section.fields) {
      if (field.kind !== "text" && field.kind !== "textarea") continue;
      if (!source.includes(field.key)) orphans.push(`${section.key}.${field.key}`);
    }
  }
  return orphans;
}

const HOME_SOURCE = sourceOf(
  [
    "home-hero",
    "home-claims",
    "home-suite",
    "home-gallery",
    "home-faq",
    "home-location",
  ].map((name) => `src/components/marketing/home/${name}.tsx`),
);

const FOLDED_INTO_ANOTHER_VALUE = new Set([
  "hero.staticImage",
  "location.latitude",
  "location.longitude",
]);

describe("every CMS field reaches the page — §5.1", () => {
  const content = resolveHomeContent(null) as unknown as Record<
    string,
    Record<string, unknown>
  >;

  it("uses the static hero image only when the carousel is empty", () => {
    const withStatic = resolveHomeContent({
      hero: { slides: [], staticImage: "/uploads/still.webp" },
    }) as unknown as { hero: { slides: { url: string }[] } };

    expect(withStatic.hero.slides.map((item) => item.url)).toEqual([
      "/uploads/still.webp",
    ]);
  });

  it("resolves a value for every field the editor can change", () => {
    for (const section of HOME_CMS_PAGE.sections) {
      for (const field of section.fields) {
        const path = `${section.key}.${field.key}`;
        if (FOLDED_INTO_ANOTHER_VALUE.has(path)) continue;
        expect(
          content[section.key]?.[field.key],
          `${path} is editable but never resolved`,
        ).toBeDefined();
      }
    }
  });

  it("references every resolved text label somewhere in the home components", () => {
    expect(
      orphanTextFields(HOME_CMS_PAGE, HOME_SOURCE, ["seo", "location"]),
      "editable in the CMS but not used by any component",
    ).toEqual([]);
  });

  it("leaves no button label hardcoded in the home components", () => {
    const hardcoded = [
      "Check availability",
      "Reveal more",
      "Swipe to explore",
      "Explore the suites",
      "Open map",
      "A larger view of this WellPlace space",
    ].filter(
      (label) =>
        HOME_SOURCE.includes(`>${label}<`) ||
        HOME_SOURCE.includes(`\n            ${label}\n`),
    );

    expect(hardcoded, "still hardcoded instead of read from the CMS").toEqual([]);
  });
});

describe("every reservation field reaches the banner — §5.1", () => {
  const SOURCE = sourceOf(["src/components/marketing/reservation-section.tsx"]);

  it("resolves every shared field", () => {
    const shared = resolveReservationContent(null).shared as unknown as Record<
      string,
      unknown
    >;

    for (const field of RESERVATION_CMS_PAGE.sections[0]?.fields ?? []) {
      expect(shared[field.key], `content.${field.key} is never resolved`).toBeDefined();
    }
  });

  it("references every shared text label in the banner component", () => {
    expect(orphanTextFields(RESERVATION_CMS_PAGE, SOURCE, ["placement"])).toEqual([]);
  });

  it("leaves no banner label hardcoded", () => {
    expect(SOURCE.includes(">Book now<")).toBe(false);
    expect(SOURCE.includes(">Reservations<")).toBe(false);
  });
});

describe("the reservation placement list matches the site — §5.1", () => {
  const ROUTE_FILES: Record<string, string> = {
    home: "src/app/(site)/page.tsx",
    suites: "src/app/(site)/suites/page.tsx",
    book: "src/app/(site)/book/page.tsx",
    faq: "src/app/(site)/faq/page.tsx",
    contact: "src/app/(site)/contact/page.tsx",
  };

  it("gives every listed page a slot the switch can actually control", () => {
    const missing = RESERVATION_PAGES.filter((page) => {
      const file = ROUTE_FILES[page.value];
      return !file || !readFileSync(file, "utf8").includes(`<ReservationSlot page="${page.value}"`);
    }).map((page) => page.value);

    expect(missing, "offered in the CMS but never rendered").toEqual([]);
  });

  it("starts switched on only where the banner already appeared", () => {
    const on = RESERVATION_PLACEMENT_DEFAULTS.filter((row) => row.enabled).map(
      (row) => row.page,
    );

    expect(on).toEqual(["home", "suites"]);
  });
});

describe("every FAQ field reaches the page — §5.1", () => {
  const SOURCE = sourceOf([
    "src/app/(site)/faq/page.tsx",
    "src/components/marketing/faq-accordion.tsx",
    "src/components/marketing/home/home-faq.tsx",
  ]);

  it("resolves every hero field", () => {
    const hero = resolveFaqContent(null).hero as unknown as Record<string, unknown>;

    for (const field of FAQ_CMS_PAGE.sections[0]?.fields ?? []) {
      expect(hero[field.key], `hero.${field.key} is never resolved`).toBeDefined();
    }
  });

  it("references every FAQ text label on the page", () => {
    expect(orphanTextFields(FAQ_CMS_PAGE, SOURCE, ["seo"])).toEqual([]);
  });

  it("leaves no FAQ hero label hardcoded", () => {
    for (const label of ["Frequently asked", "Book now", "Contact us"]) {
      expect(SOURCE.includes(`>${label}<`), `${label} is still hardcoded`).toBe(false);
    }
  });

  it("keeps one FAQ list, not two", () => {
    const homeFaq = HOME_CMS_PAGE.sections.find((section) => section.key === "faq");
    const questionLists = homeFaq?.fields.filter((field) => field.kind === "repeater") ?? [];

    expect(questionLists, "the home page must not carry its own question list").toEqual([]);
  });
});

describe("every concept and suites field reaches the page — §5.1", () => {
  const CONCEPT_SOURCE = sourceOf(["src/components/marketing/concept-fomo-story.tsx"]);
  const SUITES_SOURCE = sourceOf(["src/components/marketing/suites-experience.tsx"]);

  it("resolves every concept hero field", () => {
    const hero = resolveConceptContent(null).hero as unknown as Record<string, unknown>;

    for (const field of CONCEPT_CMS_PAGE.sections[0]?.fields ?? []) {
      expect(hero[field.key], `hero.${field.key} is never resolved`).toBeDefined();
    }
  });

  it("references every concept text label in the story component", () => {
    expect(orphanTextFields(CONCEPT_CMS_PAGE, CONCEPT_SOURCE, ["seo"])).toEqual([]);
  });

  it("references every suites text label in the experience component", () => {
    expect(orphanTextFields(SUITES_CMS_PAGE, SUITES_SOURCE, ["seo"])).toEqual([]);
  });

  it("uses the existing image cards for facilities without a separate section — CLIENT 14 September 2026", () => {
    expect(SUITES_CMS_PAGE.sections.map((section) => section.key)).toEqual([
      "hero", "tour", "cards", "seo",
    ]);
  });

  it("puts the tour introduction back on the page", () => {
    expect(SUITES_SOURCE.includes("tour.body")).toBe(true);
  });
});

describe("every booking field reaches the page — §5.1", () => {
  const SOURCE = sourceOf([
    "src/app/(site)/book/page.tsx",
    "src/components/marketing/booking-page-sections.tsx",
  ]);

  it("resolves every hero and message field", () => {
    const content = resolveBookingContent(null) as unknown as Record<
      string,
      Record<string, unknown>
    >;

    for (const key of ["hero", "messages"]) {
      const section = BOOK_CMS_PAGE.sections.find((entry) => entry.key === key);
      for (const field of section?.fields ?? []) {
        expect(
          content[key]?.[field.key],
          `${key}.${field.key} is never resolved`,
        ).toBeDefined();
      }
    }
  });

  it("references every booking text label on the page", () => {
    expect(orphanTextFields(BOOK_CMS_PAGE, SOURCE, ["seo"])).toEqual([]);
  });

  it("offers the Booking gallery requested in the latest client booking details", () => {
    expect(BOOK_CMS_PAGE.sections.map((section) => section.key)).toEqual([
      "hero", "gallery", "messages", "seo",
    ]);

    const gallery = BOOK_CMS_PAGE.sections.find((section) => section.key === "gallery");
    const repeater = gallery?.fields.find((field) => field.kind === "repeater");
    expect(repeater?.kind).toBe("repeater");
    if (repeater?.kind !== "repeater") return;

    expect(repeater.fields.map((field) => field.key)).toEqual(["src"]);
    expect(
      repeater.fields.some((field) => field.kind === "text" || field.kind === "textarea"),
      "image descriptions are not a CMS field — §9.7",
    ).toBe(false);
  });

  it("leaves no booking message hardcoded", () => {
    for (const phrase of [
      "We could not load booking options just now.",
      "We could not load available times just now.",
      "The add-on list did not load.",
      "Complete your booking",
      "Loading booking form",
    ]) {
      expect(SOURCE.includes(`"${phrase}`), `${phrase} is still hardcoded`).toBe(false);
    }
  });

});

describe("every contact field reaches the page — §5.1", () => {
  const SOURCE = sourceOf([
    "src/app/(site)/contact/page.tsx",
    "src/components/marketing/contact-form.tsx",
  ]);

  it("resolves a value for every field the editor can change", () => {
    const content = resolveContactContent(null) as unknown as Record<
      string,
      Record<string, unknown>
    >;

    for (const section of CONTACT_CMS_PAGE.sections) {
      if (section.key === "seo") continue;
      for (const field of section.fields) {
        expect(
          content[section.key]?.[field.key],
          `${section.key}.${field.key} is never resolved`,
        ).toBeDefined();
      }
    }
  });

  it("references every contact text label on the page", () => {
    expect(orphanTextFields(CONTACT_CMS_PAGE, SOURCE, ["seo"])).toEqual([]);
  });

  it("leaves no contact label hardcoded", () => {
    for (const phrase of [
      "Talk to our team",
      "Send message",
      "Sending message",
      "Send another message",
      "Get directions",
      "Message us",
      "We&apos;re here to help",
      "Please check the highlighted fields and try again.",
    ]) {
      expect(SOURCE.includes(`>${phrase}<`), `${phrase} is still hardcoded`).toBe(false);
      expect(SOURCE.includes(`"${phrase}"`), `${phrase} is still hardcoded`).toBe(false);
    }
  });
});

describe("editors change button text, never where it goes — [CLIENT]", () => {
  it("offers no link field anywhere in the CMS", () => {
    const offenders: string[] = [];

    for (const page of CMS_PAGES) {
      for (const section of page.sections) {
        for (const field of section.fields) {
          const leaves =
            field.kind === "repeater" ? field.fields : [field];
          for (const leaf of leaves) {
            const namesADestination =
              /href|url|page|route|link/i.test(leaf.key) &&
              !/label|text|heading|title/i.test(leaf.key);
            const isBoundedChoice = leaf.kind === "select" || leaf.kind === "toggle";
            const isSocialProfile = page.slug === "footer" && section.key === "social";
            if (!isSocialProfile && namesADestination && leaf.kind !== "image" && !isBoundedChoice) {
              offenders.push(`${page.slug}.${section.key}.${leaf.key}`);
            }
          }
        }
      }
    }

    expect(
      offenders,
      "a destination must be a select over the site's own routes, never typed",
    ).toEqual([]);
  });

  it("keeps the one bounded exception bounded", () => {
    const linkRow = NAVBAR_CMS_PAGE.sections
      .find((section) => section.key === "links")
      ?.fields.find((field) => field.kind === "repeater");
    const pageField =
      linkRow?.kind === "repeater"
        ? linkRow.fields.find((leaf) => leaf.key === "page")
        : undefined;

    expect(pageField?.kind).toBe("select");
    if (pageField?.kind !== "select") return;

    const routes = new Set<string>(
      Object.values(MARKETING_ROUTES).map((route) => route.href),
    );
    for (const option of pageField.options) {
      expect(routes.has(option.value), `${option.value} is not a page of this site`).toBe(
        true,
      );
    }
  });

  it("keeps every resolved button destination out of stored content", () => {
    const stored = { content: { primaryHref: "https://example.com" } };

    expect(resolveReservationContent(stored).shared.primaryHref).toBe(
      RESERVATION_CONTENT.primaryHref,
    );
  });
});

describe("every site chrome field reaches the site — §5.1", () => {
  const NAV_SOURCE = sourceOf(["src/components/marketing/home/home-nav.tsx"]);
  const FOOTER_SOURCE = sourceOf(["src/components/marketing/home/home-footer.tsx"]);

  it("references every navbar and footer text label", () => {
    expect(orphanTextFields(NAVBAR_CMS_PAGE, NAV_SOURCE, ["links"])).toEqual([]);
    expect(orphanTextFields(FOOTER_CMS_PAGE, FOOTER_SOURCE, [])).toEqual([]);
  });

  it("leaves no chrome label hardcoded", () => {
    for (const phrase of ["Book now", "Open menu", "Close menu"]) {
      expect(NAV_SOURCE.includes(`"${phrase}"`), `${phrase} is still hardcoded`).toBe(
        false,
      );
    }
    for (const phrase of ["Explore", "Company", "Cookie settings", "Legal"]) {
      expect(
        FOOTER_SOURCE.includes(`>${phrase}<`),
        `${phrase} is still hardcoded`,
      ).toBe(false);
    }
  });

  it("keeps every site page on the shared chrome, not its own copy", () => {
    for (const route of [
      "src/app/(site)/page.tsx",
      "src/app/(site)/concept/page.tsx",
      "src/app/(site)/suites/page.tsx",
      "src/app/(site)/book/page.tsx",
      "src/app/(site)/faq/page.tsx",
      "src/app/(site)/contact/page.tsx",
    ]) {
      const source = readFileSync(route, "utf8");
      expect(source.includes("<SiteNavSlot"), `${route} bypasses the nav slot`).toBe(
        true,
      );
      expect(
        source.includes("<SiteFooterSlot"),
        `${route} bypasses the footer slot`,
      ).toBe(true);
    }
  });
});

describe("the venue has one address, everywhere — §4.3, §13", () => {
  it("gives the page, the map, the directions and the search listing the same address", () => {
    const home = resolveHomeContent(null);
    const contactPage = readFileSync("src/app/(site)/contact/page.tsx", "utf8");
    const listing = organisationJsonLd() as {
      "@graph": { address?: { streetAddress?: string } }[];
    };

    expect(home.location.addressLines).toEqual(VENUE_ADDRESS_LINES);
    expect(contactPage.includes("VENUE_ADDRESS_LINES")).toBe(true);
    expect(
      listing["@graph"].some((node) =>
        node.address?.streetAddress?.includes(VENUE_ADDRESS_LINES[0]),
      ),
    ).toBe(true);
  });

  it("offers no way to edit the address into disagreement", () => {
    const editable = CMS_PAGES.flatMap((page) =>
      page.sections.flatMap((section) =>
        section.fields
          .filter((field) => /address/i.test(field.key))
          .map((field) => `${page.slug}.${section.key}.${field.key}`),
      ),
    );

    expect(editable, "the venue address must not be CMS-editable").toEqual([]);
  });
});
