import { HOME_PAGE_CONTENT } from "@/lib/config/home";
import {
  image,
  paragraph,
  repeater,
  text,
  toggle,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { FAQ_PAGE_CONTENT, FAQ_QUESTIONS } from "@/lib/config/faq";
import { OG_IMAGE } from "@/lib/config/seo";

const faq = FAQ_PAGE_CONTENT;

export const FAQ_CMS_PAGE: CmsPageSpec = {
  slug: "faq",
  label: "FAQ page",
  description:
    "Every question on the site. Each one picks its own heading, and can also appear on the home page.",
  icon: "message",
  group: "Pages",
  route: "/faq",
  revalidateRoutes: ["/"],
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "message",
      title: "Page header",
      description: "The heading and the two buttons at the top of the FAQ page.",
      fields: [
        text("title", "Heading", faq.hero.title),
        text("accent", "Heading accent", faq.hero.accent, "Rendered in the italic accent face on its own line."),
        paragraph("body", "Introduction", faq.hero.body),
        text("primaryLabel", "First button text", faq.hero.primaryLabel, "Always links to the booking page."),
        text("secondaryLabel", "Second button text", faq.hero.secondaryLabel, "Always links to the contact page."),
      ],
    },
    {
      key: "questions",
      label: "Questions",
      icon: "list",
      title: "Questions and answers",
      description:
        "The whole list, in order. Questions sharing a heading are grouped together on the FAQ page, in the order they first appear here.",
      fields: [
        repeater(
          "entries",
          "Questions",
          "Question",
          60,
          [
            text("question", "Question", ""),
            paragraph("answer", "Answer", ""),
            text(
              "group",
              "Heading",
              FAQ_QUESTIONS[0]?.group ?? "",
              "The heading this question sits under on the FAQ page. Reuse a heading to group questions together.",
            ),
            toggle("showOnHome", "Also show on the home page", false, {
              on: "On the home page",
              off: "FAQ page only",
            }),
          ],
          FAQ_QUESTIONS.map((entry) => ({ ...entry })),
          "Switch a question on to add it to the shorter list on the home page.",
        ),
        text(
          "emptyLabel",
          "Message when the list is empty",
          FAQ_PAGE_CONTENT.emptyLabel,
          "Shown on the FAQ page while there are no questions to display.",
        ),
      ],
    },
    {
      key: "homePreview", label: "Home preview", icon: "home", title: "FAQ preview on Home",
      description: "All Home FAQ wording is managed here. Select questions using their Home toggle on the Questions tab.",
      fields: [
        image("image", "Home FAQ image", HOME_PAGE_CONTENT.faq.image),
        text("imageAlt", "Image description", HOME_PAGE_CONTENT.faq.imageAlt),
        text("eyebrow", "Eyebrow", HOME_PAGE_CONTENT.faq.eyebrow),
        text("title", "Heading", HOME_PAGE_CONTENT.faq.title),
        text("accent", "Heading accent", HOME_PAGE_CONTENT.faq.accent),
        paragraph("body", "Introduction", HOME_PAGE_CONTENT.faq.body),
        text("linkLabel", "Link text", HOME_PAGE_CONTENT.faq.linkLabel),
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
        text("title", "Page title", faq.title, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", faq.description, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
