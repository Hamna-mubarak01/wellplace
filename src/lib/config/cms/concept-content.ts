import { describeImage } from "@/lib/config/cms/image-alt";
import {
  CONCEPT_CHAPTER_DETAIL_MAX,
  CONCEPT_CMS_PAGE,
} from "@/lib/config/cms/pages/concept";
import { itemLines, itemStr, items, str, strOr } from "@/lib/config/cms/read";
import { resolveSeo, type ResolvedSeo } from "@/lib/config/cms/seo";
import { resolveCmsValues } from "@/lib/config/cms/values";
import { CONCEPT_PAGE_CONTENT } from "@/lib/config/concept";

export interface ResolvedConceptChapter {
  readonly number: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly accent: string;
  readonly body: string;
  readonly image: string;
  readonly imageAlt: string;
  readonly details: readonly string[];
  readonly mediaSide: "left" | "right";
}

export interface ResolvedConceptContent {
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly accent: string;
    readonly body: string;
    readonly image: string;
    readonly imageAlt: string;
  };
  readonly chapters: readonly ResolvedConceptChapter[];
  readonly seo: ResolvedSeo;
}

export function resolveConceptContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedConceptContent {
  const values = resolveCmsValues(CONCEPT_CMS_PAGE, published ?? null);
  const heroImage = str(values, "hero", "image");

  return {
    hero: {
      eyebrow: str(values, "hero", "eyebrow"),
      title: strOr(values, "hero", "title", CONCEPT_PAGE_CONTENT.hero.title),
      accent: str(values, "hero", "accent"),
      body: str(values, "hero", "body"),
      image: heroImage,
      imageAlt: str(values, "hero", "imageAlt").trim() || describeImage(
        "concept.hero",
        heroImage,
        [str(values, "hero", "title"), str(values, "hero", "accent")],
        "Concept",
      ),
    },
    chapters: items(values, "chapters", "items")
      .filter((chapter) => itemStr(chapter, "title").trim() || itemStr(chapter, "body").trim())
      .map((chapter, index) => ({
        number: itemStr(chapter, "number"),
        eyebrow: itemStr(chapter, "eyebrow"),
        title: itemStr(chapter, "title"),
        accent: itemStr(chapter, "accent"),
        body: itemStr(chapter, "body"),
        image: itemStr(chapter, "image"),
        imageAlt: itemStr(chapter, "imageAlt").trim() || describeImage(
          "concept.chapters",
          itemStr(chapter, "image"),
          [itemStr(chapter, "eyebrow"), itemStr(chapter, "title"), itemStr(chapter, "accent")],
          `Chapter ${index + 1}`,
        ),
        details: itemLines(chapter, "details", CONCEPT_CHAPTER_DETAIL_MAX),
        mediaSide: itemStr(chapter, "mediaSide") === "left" ? ("left" as const) : ("right" as const),
      })),
    seo: resolveSeo(values),
  };
}
