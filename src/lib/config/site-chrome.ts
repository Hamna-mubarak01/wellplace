import { DEFAULT_SOCIAL_URLS } from "@/lib/config/social-links";
import { MARKETING_NAV_LINKS } from "@/lib/config/marketing";
import { FOOTER_DESCRIPTION, SITE_NAME } from "@/lib/config/seo";

export type SiteChromeVariant = "site" | "waitlist";

export const WAITLIST_CHROME = {
  href: "/waitlist",
  actionLabel: "Open waitlist",
  statusLabel: "Be part of what’s next",
  logoLabel: `${SITE_NAME}, waitlist`,
  backLabel: "Back to waitlist",
} as const;

export const NAVBAR_PAGE_OPTIONS: readonly [
  { value: string; label: string },
  ...{ value: string; label: string }[],
] = [
  { value: MARKETING_NAV_LINKS[0].href, label: MARKETING_NAV_LINKS[0].label },
  ...MARKETING_NAV_LINKS.slice(1).map((link) => ({
    value: link.href,
    label: link.label,
  })),
];

export const NAVBAR_CONTENT = {
  logo: "",
  favicon: "",
  bookLabel: "Book now",
  logoTopLabel: `${SITE_NAME}, back to the top`,
  logoHomeLabel: `${SITE_NAME}, home`,
  primaryNavLabel: "Primary",
  openMenuLabel: "Open menu",
  closeMenuLabel: "Close menu",
  links: MARKETING_NAV_LINKS.map((link) => ({ label: link.label, page: link.href })),
} as const;

export const FOOTER_CONTENT = {
  socialHeading: "Follow us",
  socialLinks: [
    { icon: "instagram", href: DEFAULT_SOCIAL_URLS.instagram },
    { icon: "tiktok", href: DEFAULT_SOCIAL_URLS.tiktok },
  ],
  tagline: FOOTER_DESCRIPTION,
  exploreHeading: "Explore",
  companyHeading: "Company",
  legalLabel: "Legal",
  cookieSettingsLabel: "Cookie settings",
  localityLine: "Business Bay, Dubai · United Arab Emirates",
  backToTopLabel: `${SITE_NAME}, back to the top`,
} as const;
