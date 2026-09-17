import {
  choice,
  image,
  paragraph,
  repeater,
  text,
  textLines,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { CONCEPT_CHAPTERS, CONCEPT_PAGE_CONTENT } from "@/lib/config/concept";
import { OG_IMAGE } from "@/lib/config/seo";

const concept = CONCEPT_PAGE_CONTENT;

export const CONCEPT_CHAPTER_DETAIL_MAX = 3;

export const CONCEPT_CMS_PAGE: CmsPageSpec = {
  slug: "concept",
  label: "Concept & experience",
  description: "The sticky hero and the alternating chapters that follow it.",
  icon: "sparkles",
  group: "Pages",
  route: "/concept",
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "image",
      title: "Hero section",
      description: "The full-height banner that stays in place as the page scrolls.",
      fields: [
        text("eyebrow", "Eyebrow", concept.hero.eyebrow),
        text("title", "Headline", concept.hero.title),
        text("accent", "Headline accent", concept.hero.accent, "Rendered in the italic accent face on its own line."),
        paragraph("body", "Subheading", concept.hero.body),
        image("image", "Background image", concept.hero.image, "1920×1080px or wider."),
      ],
    },
    {
      key: "chapters",
      label: "Chapters",
      icon: "layers",
      title: "Chapters",
      description:
        "Three concise chapters: privacy, the complete suite and your pace.",
      fields: [
        repeater(
          "items",
          "Chapters",
          "Chapter",
          8,
          [
            text("number", "Number", "", "Shown very large behind the copy, for example 01."),
            text("eyebrow", "Eyebrow", ""),
            text("title", "Title", ""),
            text("accent", "Title accent", ""),
            paragraph("body", "Body", ""),
            image("image", "Image", ""),
            textLines(
              "details",
              "Three lines",
              "Line",
              CONCEPT_CHAPTER_DETAIL_MAX,
              [],
              "One short sentence per line. The lines light up one at a time as the visitor scrolls.",
            ),
            choice(
              "mediaSide",
              "Image side",
              [
                { value: "left", label: "Image on the left" },
                { value: "right", label: "Image on the right" },
              ],
              "right",
            ),
          ],
          CONCEPT_CHAPTERS.map((chapter) => ({
            number: chapter.number,
            eyebrow: chapter.eyebrow,
            title: chapter.title,
            accent: chapter.accent,
            body: chapter.body,
            image: chapter.image,
            details: chapter.details.join("\n"),
            mediaSide: chapter.mediaSide,
          })),
        ),
      ],
    },
    {
      key: "seo",
      label: "SEO",
      icon: "search",
      title: "Search and sharing",
      description:
        "Publish to apply this page’s title, description and image to search and link previews. Leave a field empty to keep the default.",
      fields: [
        text("title", "Page title", concept.title, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", concept.description, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
