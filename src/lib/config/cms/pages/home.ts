import { HOME_PAGE_CONTENT } from "@/lib/config/home";
import { MARKETING_GALLERY_MAX_IMAGES } from "@/lib/config/marketing";
import { DEFAULT_DESCRIPTION, OG_IMAGE, SITE_NAME } from "@/lib/config/seo";
import {
  choice,
  grouped,
  icon,
  image,
  media,
  paragraph,
  repeater,
  text,
} from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";

const home = HOME_PAGE_CONTENT;

export const HOME_CMS_PAGE: CmsPageSpec = {
  slug: "home",
  label: "Home page",
  description: "The hero, the difference cards, the suite showcase, the gallery and the map.",
  icon: "home",
  group: "Pages",
  route: "/",
  sections: [
    {
      key: "hero",
      label: "Hero",
      icon: "image",
      title: "Hero section",
      description: "The full-height banner at the top of the home page.",
      fields: [
        media(
          "slides",
          "Hero carousel media",
          home.hero.slides,
          10,
          "Images or videos that rotate behind the hero. Leave empty to use the built-in renderings.",
        ),
        image(
          "staticImage",
          "Static background image",
          "",
          "1920×1080px. Used when the carousel is empty and as a still fallback for video slides.",
        ),
        text("title", "Headline", home.hero.title),
        text("accent", "Headline accent", home.hero.accent, "Rendered in the italic accent face on its own line."),
        paragraph("body", "Subheading", home.hero.body),
        text("primaryLabel", "Primary button text", home.hero.primaryLabel),
        text("secondaryLabel", "Secondary button text", home.hero.secondaryLabel),
      ],
    },
    {
      key: "difference",
      label: "Difference",
      icon: "sparkles",
      title: "The WellPlace difference",
      description: "The three flip cards below the hero.",
      fields: [
        text("eyebrow", "Eyebrow", home.difference.eyebrow),
        text("title", "Heading", home.difference.title),
        text("accent", "Heading accent", home.difference.accent),
        text("revealLabel", "Card button text", home.difference.revealLabel, "The button on the front of each card that flips it over."),
        text("swipeHint", "Swipe hint", home.difference.swipeHint, "Shown above the arrows on phones."),
        repeater(
          "cards",
          "Cards",
          "Card",
          6,
          [
            grouped("Front", image("image", "Image", "")),
            grouped("Front", text("label", "Label", "")),
            grouped("Front", text("title", "Title", "")),
            grouped("Back", icon("icon", "Icon", "sparkles")),
            grouped("Back", text("backLabel", "Label", "")),
            grouped("Back", text("backTitle", "Title", "")),
            grouped("Back", paragraph("detail", "Detail", "")),
            grouped("Back", text("action", "Button text", "")),
          ],
          home.difference.cards.map((card) => ({ ...card })),
          "The front shows the image, label and title. The back shows the icon, its own label and title, the detail and the button.",
        ),
      ],
    },
    {
      key: "suite",
      label: "Suite",
      icon: "layers",
      title: "Inside a suite",
      description: "The rotating suite showcase.",
      fields: [
        text("eyebrow", "Eyebrow", home.suite.eyebrow),
        text("ctaLabel", "Button text", home.suite.ctaLabel),
        repeater(
          "views",
          "Suite views",
          "View",
          8,
          [
            text("label", "Tab label", ""),
            text("title", "Title", ""),
            text("emphasis", "Title accent", ""),
            paragraph("body", "Body", ""),
            text("detailTitle", "Detail title", ""),
            text("detailBody", "Detail body", ""),
            image("image", "Image", ""),
          ],
          home.suite.views.map((view) => ({
            label: view.label,
            title: view.title,
            emphasis: view.emphasis,
            body: view.body,
            detailTitle: view.detailTitle,
            detailBody: view.detailBody,
            image: view.image,
          })),
        ),
      ],
    },
    {
      key: "bridge",
      label: "Bridge",
      icon: "image",
      title: "Full-width image",
      description: "The full-bleed photograph between the suite and gallery sections.",
      fields: [
        image("image", "Image", home.bridge.image, "1920×1080px or wider."),
      ],
    },
    {
      key: "gallery",
      label: "Gallery",
      icon: "list",
      title: "Gallery section",
      description: "Heading and introduction above the image gallery.",
      fields: [
        text("eyebrow", "Eyebrow", home.gallery.eyebrow),
        text("title", "Heading", home.gallery.title),
        text("accent", "Heading accent", home.gallery.accent),
        paragraph("body", "Introduction", home.gallery.body),
        text("viewerCaption", "Full-screen caption", home.gallery.viewerCaption, "Read out when a visitor opens an image full screen."),
        repeater(
          "shots",
          "Gallery images",
          "Image",
          MARKETING_GALLERY_MAX_IMAGES,
          [
            image("image", "Image", ""),
            choice(
              "orientation",
              "Shape",
              [
                { value: "landscape", label: "Landscape" },
                { value: "portrait", label: "Portrait" },
              ],
              "landscape",
            ),
          ],
          home.gallery.shots.map((shot) => ({
            image: shot.image,
            orientation: shot.orientation,
          })),
          "Up to nine images, shown in the rotating gallery and full-screen viewer in this order.",
        ),
      ],
    },
    {
      key: "location",
      label: "Location",
      icon: "map",
      title: "Location section",
      description:
        "The wording and the map. The address itself is the venue's registered address and is fixed in code, so it can never disagree with the address search engines are given.",
      fields: [
        text("eyebrow", "Eyebrow", home.location.eyebrow),
        text("title", "Heading", home.location.title),
        text("accent", "Heading accent", home.location.accent),
        paragraph("body", "Introduction", home.location.body),
        text("openMapLabel", "Map overlay button text", home.location.openMapLabel),
        text("directionsLabel", "Directions button text", home.location.directionsLabel),
        text("mapLabel", "Map link text", home.location.mapLabel),
        text("locality", "Area shown on the map", home.location.locality),
        text(
          "latitude",
          "Map latitude",
          home.location.latitude,
          "Decimal degrees, for example 25.1263662.",
        ),
        text(
          "longitude",
          "Map longitude",
          home.location.longitude,
          "Decimal degrees, for example 55.2186548.",
        ),
        text(
          "mapZoom",
          "Map zoom",
          home.location.mapZoom,
          "A whole number from 1 (world) to 19 (street level).",
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
        text("title", "Page title", SITE_NAME, "Shown in the browser tab and search results."),
        paragraph("description", "Meta description", DEFAULT_DESCRIPTION, "Around 150–160 characters."),
        image("ogImage", "Social sharing image", OG_IMAGE.url, "1200×630px."),
      ],
    },
  ],
};
