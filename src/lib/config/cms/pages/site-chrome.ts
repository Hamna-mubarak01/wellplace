import { choice, image, paragraph, repeater, text } from "@/lib/config/cms/fields";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { LEGAL_INDEX_HREF } from "@/lib/config/legal";
import { MARKETING_ROUTES } from "@/lib/config/marketing";
import { SOCIAL_ICON_OPTIONS } from "@/lib/config/social-icons";
import {
  FOOTER_CONTENT,
  NAVBAR_CONTENT,
  NAVBAR_PAGE_OPTIONS,
} from "@/lib/config/site-chrome";

const SITE_ROUTES: readonly string[] = [
  "/",
  ...Object.values(MARKETING_ROUTES).map((route) => route.href),
  LEGAL_INDEX_HREF,
];

export const NAVBAR_CMS_PAGE: CmsPageSpec = {
  slug: "navbar",
  label: "Navigation bar",
  description: "Website logo, browser icon, menu links and booking button.",
  icon: "share",
  group: "Shared",
  route: null,
  revalidateRoutes: SITE_ROUTES,
  editableNote:
    "Menu links point at pages on this site, you choose which page, you cannot type a web address.",
  sections: [
    {
      key: "branding",
      label: "Logo & favicon",
      icon: "image",
      title: "Logo & favicon",
      description: "Manage the website branding here. Remove an upload to use the original artwork. Changes go live when you publish.",
      fields: [
        { ...image("logo", "Website logo", NAVBAR_CONTENT.logo, "Used in the header, phone menu and footer. Choose a light logo on a transparent PNG background for the dark header and footer."), previewFit: "contain" },
        { ...image("favicon", "Favicon", NAVBAR_CONTENT.favicon, "The small icon in browser tabs. Upload an ICO file or a square PNG (ideally 512 × 512 pixels)."), previewFit: "contain", faviconOnly: true },
      ],
    },
    {
      key: "links",
      label: "Links",
      icon: "list",
      title: "Menu links",
      description:
        "Shown across the header on wide screens, in the slide-out menu on phones, and in the footer's Explore column.",
      fields: [
        repeater(
          "items",
          "Links",
          "Link",
          8,
          [
            text("label", "Link text", ""),
            choice("page", "Page", NAVBAR_PAGE_OPTIONS, NAVBAR_PAGE_OPTIONS[0].value),
          ],
          NAVBAR_CONTENT.links.map((link) => ({ ...link })),
          "Choose which page each link opens. You can rename a link, reorder the menu, or leave a page out.",
        ),
      ],
    },
    {
      key: "actions",
      label: "Button and labels",
      icon: "megaphone",
      title: "Button and screen-reader labels",
      description:
        "The booking button appears twice — in the header and inside the phone menu. Both use this text.",
      fields: [
        text("bookLabel", "Booking button text", NAVBAR_CONTENT.bookLabel, "Always links to the booking page."),
        text("logoTopLabel", "Logo label, over a hero", NAVBAR_CONTENT.logoTopLabel, "Read out by screen readers."),
        text("logoHomeLabel", "Logo label, elsewhere", NAVBAR_CONTENT.logoHomeLabel),
        text("primaryNavLabel", "Menu label", NAVBAR_CONTENT.primaryNavLabel),
        text("openMenuLabel", "Open menu label", NAVBAR_CONTENT.openMenuLabel),
        text("closeMenuLabel", "Close menu label", NAVBAR_CONTENT.closeMenuLabel),
      ],
    },
  ],
};

export const FOOTER_CMS_PAGE: CmsPageSpec = {
  slug: "footer",
  label: "Footer",
  description: "The band at the bottom of every page.",
  icon: "layers",
  group: "Shared",
  route: null,
  revalidateRoutes: SITE_ROUTES,
  editableNote:
    "Edit the social links here. The contact email stays fixed.",
  sections: [
    {
      key: "brand",
      label: "Brand",
      icon: "image",
      title: "Brand column",
      description: "The wordmark and the sentence beneath it.",
      fields: [
        paragraph("tagline", "Tagline", FOOTER_CONTENT.tagline),
        text("backToTopLabel", "Logo label", FOOTER_CONTENT.backToTopLabel, "Read out by screen readers."),
      ],
    },
    {
      key: "columns",
      label: "Columns",
      icon: "list",
      title: "Column headings and links",
      description: "The two columns of links beside the brand.",
      fields: [
        text("exploreHeading", "First column heading", FOOTER_CONTENT.exploreHeading),
        text("companyHeading", "Second column heading", FOOTER_CONTENT.companyHeading),
        text("legalLabel", "Legal link text", FOOTER_CONTENT.legalLabel, "Always opens the legal page."),
        text("cookieSettingsLabel", "Cookie settings text", FOOTER_CONTENT.cookieSettingsLabel),
      ],
    },
    {
      key: "social", label: "Social links", icon: "share",
      title: "Social links", description: "Choose an icon and add its profile link. An empty list hides this section.",
      fields: [
        text("socialHeading", "Heading", FOOTER_CONTENT.socialHeading),
        repeater("socialLinks", "Profiles", "Profile", 8, [
          { ...choice("icon", "Icon", SOCIAL_ICON_OPTIONS, "website"), iconSet: "social" },
          text("href", "Profile URL", "", "A full HTTPS address."),
        ], FOOTER_CONTENT.socialLinks),
      ],
    },
    {
      key: "base",
      label: "Bottom line",
      icon: "map",
      title: "Bottom line",
      description: "The line under the divider, beside the copyright.",
      fields: [text("localityLine", "Location line", FOOTER_CONTENT.localityLine)],
    },
  ],
};
