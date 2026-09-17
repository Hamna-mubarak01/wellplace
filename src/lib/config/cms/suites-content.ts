import { describeImage } from "@/lib/config/cms/image-alt";
import {
  SUITE_CARD_FACILITY_MAX,
  SUITES_CMS_PAGE,
} from "@/lib/config/cms/pages/suites";
import { itemLines, itemStr, items, str, strOr } from "@/lib/config/cms/read";
import { resolveSeo, type ResolvedSeo } from "@/lib/config/cms/seo";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { SUITES_PAGE_CONTENT } from "@/lib/config/suites";

export interface ResolvedSuiteBand {
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly body: string;
}

export interface ResolvedSuiteCard extends ResolvedSuiteBand {
  readonly image: string;
  readonly imageAlt: string;
  readonly facilities: readonly string[];
}

export interface ResolvedSuitesContent {
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly image: string;
    readonly imageAlt: string;
  };
  readonly tour: ResolvedSuiteBand;
  readonly cards: readonly ResolvedSuiteCard[];
  readonly seo: ResolvedSeo;
}

function band(
  values: ReturnType<typeof resolveCmsValues>,
  section: string,
): ResolvedSuiteBand {
  return {
    eyebrow: str(values, section, "eyebrow"),
    title: str(values, section, "title"),
    accent: str(values, section, "accent"),
    body: str(values, section, "body"),
  };
}

export function resolveSuitesContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedSuitesContent {
  const values = resolveCmsValues(SUITES_CMS_PAGE, published ?? null);
  const heroImage = str(values, "hero", "image");

  return {
    hero: {
      eyebrow: str(values, "hero", "eyebrow"),
      title: strOr(values, "hero", "title", SUITES_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      image: heroImage,
      imageAlt: str(values, "hero", "imageAlt").trim() || describeImage(
        "suites.hero",
        heroImage,
        [str(values, "hero", "title"), str(values, "hero", "accent")],
        "Suites",
      ),
    },
    tour: band(values, "tour"),
    cards: items(values, "cards", "items")
      .filter((card) => itemStr(card, "title").trim() || itemStr(card, "body").trim())
      .map((card, index) => ({
        eyebrow: itemStr(card, "eyebrow"),
        title: itemStr(card, "title"),
        accent: itemStr(card, "accent"),
        body: itemStr(card, "body"),
        image: itemStr(card, "image"),
        imageAlt: itemStr(card, "imageAlt").trim() || describeImage(
          "suites.cards",
          itemStr(card, "image"),
          [itemStr(card, "eyebrow"), itemStr(card, "title"), itemStr(card, "accent")],
          `Suite card ${index + 1}`,
        ),
        facilities: itemLines(card, "facilities", SUITE_CARD_FACILITY_MAX),
      })),
    seo: resolveSeo(values),
  };
}
