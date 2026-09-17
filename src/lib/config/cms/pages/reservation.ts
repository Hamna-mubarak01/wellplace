import {
  choice,
  image,
  paragraph,
  repeater,
  text,
  toggle,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import {
  RESERVATION_CONTENT,
  RESERVATION_PAGES,
  RESERVATION_PLACEMENT_DEFAULTS,
  RESERVATION_ROUTES,
} from "@/lib/config/reservation";

const reservation = RESERVATION_CONTENT;

const PAGE_OPTIONS = RESERVATION_PAGES.map((page) => ({
  value: page.value,
  label: page.label,
}));

export const RESERVATION_CMS_PAGE: CmsPageSpec = {
  slug: "reservation",
  label: "Reservation banner",
  description:
    "The closing “book now” banner. Edited once here, then switched on or reworded per page.",
  icon: "megaphone",
  group: "Shared",
  route: null,
  revalidateRoutes: RESERVATION_ROUTES,
  sections: [
    {
      key: "content",
      label: "Content",
      icon: "megaphone",
      title: "Shared content",
      description:
        "What the banner says everywhere, unless a page below overrides it.",
      fields: [
        text("eyebrow", "Eyebrow", reservation.eyebrow),
        text("title", "Heading", reservation.title),
        text("accent", "Heading accent", reservation.accent),
        paragraph("body", "Body", reservation.body),
        text("primaryLabel", "Button text", reservation.primaryLabel, "Always links to the booking page."),
        image("image", "Background image", reservation.image, "1920×1080px or wider."),
      ],
    },
    {
      key: "placement",
      label: "Placement",
      icon: "list",
      title: "Where it appears",
      description:
        "One row per page. Switch a page off to hide the banner there. Leave an override blank to use the shared wording above.",
      fields: [
        repeater(
          "pages",
          "Pages",
          "Page",
          RESERVATION_PAGES.length,
          [
            choice("page", "Page", PAGE_OPTIONS, PAGE_OPTIONS[0]?.value ?? "home"),
            toggle("enabled", "Show the banner", true, { on: "Shown", off: "Hidden" }),
            { ...text("eyebrow", "Eyebrow override", ""), required: false },
            { ...text("title", "Heading override", ""), required: false },
            { ...text("accent", "Heading accent override", ""), required: false },
            { ...paragraph("body", "Body override", ""), required: false },
            { ...text("primaryLabel", "Button text override", ""), required: false },
            { ...image("image", "Background image override", ""), required: false },
          ],
          RESERVATION_PLACEMENT_DEFAULTS,
          "All overrides are optional. Leave any blank to use the shared content. To hide the banner on a page, switch its row off rather than deleting it.",
        ),
      ],
    },
  ],
};
