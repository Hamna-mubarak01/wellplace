import {
  FOOTER_CMS_PAGE,
  NAVBAR_CMS_PAGE,
} from "@/lib/config/cms/pages/site-chrome";
import { safeImageSrc, safeWebHref } from "@/lib/config/cms/links";
import { itemStr, items, strOr } from "@/lib/config/cms/read";
import { resolveCmsValues } from "@/lib/config/cms/values";
import type { MarketingNavigationLink } from "@/lib/config/marketing";
import { FOOTER_CONTENT, NAVBAR_CONTENT } from "@/lib/config/site-chrome";
import { resolveSocialIcon, socialIconLabel, type SocialIconName } from "@/lib/config/social-icons";

export interface ResolvedNavbar {
  readonly logo: string;
  readonly favicon: string;
  readonly links: readonly MarketingNavigationLink[];
  readonly bookLabel: string;
  readonly logoTopLabel: string;
  readonly logoHomeLabel: string;
  readonly primaryNavLabel: string;
  readonly openMenuLabel: string;
  readonly closeMenuLabel: string;
}

export interface ResolvedFooter {
  readonly socialHeading: string;
  readonly socialLinks: readonly { label: string; href: string; icon: SocialIconName }[];
  readonly tagline: string;
  readonly backToTopLabel: string;
  readonly exploreHeading: string;
  readonly companyHeading: string;
  readonly legalLabel: string;
  readonly cookieSettingsLabel: string;
  readonly localityLine: string;
}

const ALLOWED_PAGES = new Set(NAVBAR_CONTENT.links.map((link) => link.page));

export function resolveNavbarContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedNavbar {
  const values = resolveCmsValues(NAVBAR_CMS_PAGE, published ?? null);

  const links = items(values, "links", "items")
    .map((item) => ({
      label: itemStr(item, "label").trim(),
      href: itemStr(item, "page").trim(),
    }))
    .filter((link) => link.label.length > 0 && ALLOWED_PAGES.has(link.href));

  return {
    logo: safeImageSrc(strOr(values, "branding", "logo", NAVBAR_CONTENT.logo), ""),
    favicon: safeImageSrc(strOr(values, "branding", "favicon", NAVBAR_CONTENT.favicon), ""),
    links:
      links.length > 0
        ? links
        : NAVBAR_CONTENT.links.map((link) => ({
            label: link.label,
            href: link.page,
          })),
    bookLabel: strOr(values, "actions", "bookLabel", NAVBAR_CONTENT.bookLabel),
    logoTopLabel: strOr(values, "actions", "logoTopLabel", NAVBAR_CONTENT.logoTopLabel),
    logoHomeLabel: strOr(values, "actions", "logoHomeLabel", NAVBAR_CONTENT.logoHomeLabel),
    primaryNavLabel: strOr(
      values,
      "actions",
      "primaryNavLabel",
      NAVBAR_CONTENT.primaryNavLabel,
    ),
    openMenuLabel: strOr(values, "actions", "openMenuLabel", NAVBAR_CONTENT.openMenuLabel),
    closeMenuLabel: strOr(
      values,
      "actions",
      "closeMenuLabel",
      NAVBAR_CONTENT.closeMenuLabel,
    ),
  };
}

export function resolveFooterContent(
  published: Record<string, unknown> | null | undefined,
): ResolvedFooter {
  const values = resolveCmsValues(FOOTER_CMS_PAGE, published ?? null);

  return {
    socialHeading: strOr(values, "social", "socialHeading", FOOTER_CONTENT.socialHeading),
    socialLinks: items(values, "social", "socialLinks")
      .map((item) => {
        const href = safeWebHref(itemStr(item, "href"));
        const icon = resolveSocialIcon(itemStr(item, "icon"), href);
        return { label: socialIconLabel(icon), href, icon };
      })
      .filter((link) => link.href),
    tagline: strOr(values, "brand", "tagline", FOOTER_CONTENT.tagline),
    backToTopLabel: strOr(
      values,
      "brand",
      "backToTopLabel",
      FOOTER_CONTENT.backToTopLabel,
    ),
    exploreHeading: strOr(
      values,
      "columns",
      "exploreHeading",
      FOOTER_CONTENT.exploreHeading,
    ),
    companyHeading: strOr(
      values,
      "columns",
      "companyHeading",
      FOOTER_CONTENT.companyHeading,
    ),
    legalLabel: strOr(values, "columns", "legalLabel", FOOTER_CONTENT.legalLabel),
    cookieSettingsLabel: strOr(
      values,
      "columns",
      "cookieSettingsLabel",
      FOOTER_CONTENT.cookieSettingsLabel,
    ),
    localityLine: strOr(values, "base", "localityLine", FOOTER_CONTENT.localityLine),
  };
}
