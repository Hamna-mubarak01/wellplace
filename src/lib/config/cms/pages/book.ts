import {
  image,
  repeater,
  paragraph,
  text,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { BOOKING_PAGE_CONTENT } from "@/lib/config/booking-page";
import { OG_IMAGE } from "@/lib/config/seo";

import { BOOKING_RENDERINGS } from "@/lib/config/booking-media";

const booking = BOOKING_PAGE_CONTENT;

export const BOOK_CMS_PAGE: CmsPageSpec = {
  slug: "book",
  label: "Booking process",
  description:
    "The banner above the booking widget and its loading and availability messages.",
  icon: "calendar",
  group: "Pages",
  route: "/book",
  editableNote:
    "The booking widget itself is not editable here. Dates, durations, guest limits and prices come from settings.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "image",
      title: "Hero section",
      description: "The banner above the booking widget.",
      fields: [
        text("eyebrow", "Eyebrow", booking.hero.eyebrow),
        text("title", "Headline", booking.hero.title),
        text("accent", "Headline accent", booking.hero.accent, "Rendered in the italic accent face."),
        paragraph("body", "Subheading", booking.hero.body),
        image("image", "Background image", booking.hero.image, "1920×1080px or wider."),
      ],
    },
    { key: "gallery", label: "Gallery", icon: "image", title: "Booking gallery", description: "Up to nine views, in display order. Replace renderings with photographs here.", fields: [repeater("views", "Views", "View", 9, [image("src", "Image", "")], BOOKING_RENDERINGS.map(({src})=>({src})))] },
    {
      key: "messages",
      label: "Messages",
      icon: "message",
      title: "Booking messages",
      description:
        "What the booking widget says while it loads, and when something is unavailable. Keep these plain and say what to do next.",
      fields: [
        text("widgetLabel", "Booking area label", booking.messages.widgetLabel, "Read out by screen readers as the name of the booking area."),
        text("loadingLabel", "Loading label", booking.messages.loadingLabel),
        paragraph("settingsUnavailable", "Booking options unavailable", booking.messages.settingsUnavailable),
        paragraph("rateLimited", "Too many availability checks", booking.messages.rateLimited),
        paragraph("timesUnavailable", "Times unavailable", booking.messages.timesUnavailable),
        paragraph("systemUnreachable", "Booking system unreachable", booking.messages.systemUnreachable),
        paragraph("addonsUnavailable", "Add-ons unavailable", booking.messages.addonsUnavailable),
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
        text("title", "Page title", booking.title, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", booking.description, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
