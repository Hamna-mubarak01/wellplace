import {
  image,
  paragraph,
  repeater,
  text,
  textLines,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { SUITES_PAGE_CONTENT, SUITE_STORY_CARDS } from "@/lib/config/suites";
import { OG_IMAGE } from "@/lib/config/seo";

const suites = SUITES_PAGE_CONTENT;

export const SUITE_CARD_FACILITY_MAX = 6;

export const SUITES_CMS_PAGE: CmsPageSpec = {
  slug: "suites",
  label: "Suites & facilities",
  description: "The hero, the tour heading and the stack of suite cards.",
  icon: "layers",
  group: "Pages",
  route: "/suites",
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "image",
      title: "Hero section",
      description: "The banner at the top of the suites page.",
      fields: [
        text("eyebrow", "Eyebrow", suites.hero.eyebrow),
        text("title", "Headline", suites.hero.title),
        text("accent", "Headline accent", suites.hero.accent, "Rendered in the italic accent face."),
        paragraph("body", "Subheading", suites.hero.body),
        image("image", "Background image", suites.hero.image, "1920×1080px or wider."),
      ],
    },
    {
      key: "tour",
      label: "Tour",
      icon: "layers",
      title: "Tour heading",
      description: "The heading above the stack of suite cards.",
      fields: [
        text("eyebrow", "Eyebrow", suites.tour.eyebrow),
        text("title", "Heading", suites.tour.title),
        text("accent", "Heading accent", suites.tour.accent),
        paragraph("body", "Introduction", suites.tour.body),
      ],
    },
    {
      key: "cards",
      label: "Cards",
      icon: "list",
      title: "Suite cards",
      description: "The stacking cards, in order. Each one carries its own image and facilities.",
      fields: [
        repeater(
          "items",
          "Cards",
          "Card",
          8,
          [
            text("eyebrow", "Eyebrow", ""),
            text("title", "Title", ""),
            text("accent", "Title accent", ""),
            paragraph("body", "Body", ""),
            image("image", "Image", ""),
            textLines(
              "facilities",
              "Facilities",
              "Facility",
              SUITE_CARD_FACILITY_MAX,
              [],
              "One short phrase per line, listed beside the body.",
            ),
          ],
          SUITE_STORY_CARDS.map((card) => ({
            eyebrow: card.eyebrow,
            title: card.title,
            accent: card.accent,
            body: card.body,
            image: card.image,
            facilities: card.facilities.join("\n"),
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
        text("title", "Page title", suites.title, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", suites.description, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
