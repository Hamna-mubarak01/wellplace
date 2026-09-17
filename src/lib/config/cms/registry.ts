import { URLS_CMS_PAGE } from "@/lib/config/cms/pages/urls";
import { LEGAL_CMS_PAGE } from "@/lib/config/cms/pages/legal";
import { withImageAltFields } from "@/lib/config/cms/alt-fields";
import { BOOK_CMS_PAGE } from "@/lib/config/cms/pages/book";
import { CONCEPT_CMS_PAGE } from "@/lib/config/cms/pages/concept";
import { CONTACT_CMS_PAGE } from "@/lib/config/cms/pages/contact";
import { FAQ_CMS_PAGE } from "@/lib/config/cms/pages/faq";
import { HOME_CMS_PAGE } from "@/lib/config/cms/pages/home";
import { RESERVATION_CMS_PAGE } from "@/lib/config/cms/pages/reservation";
import {
  FOOTER_CMS_PAGE,
  NAVBAR_CMS_PAGE,
} from "@/lib/config/cms/pages/site-chrome";
import { SUITES_CMS_PAGE } from "@/lib/config/cms/pages/suites";
import type { CmsPageSpec } from "@/lib/config/cms/types";

export {
  BOOK_CMS_PAGE,
  CONCEPT_CMS_PAGE,
  CONTACT_CMS_PAGE,
  FAQ_CMS_PAGE,
  FOOTER_CMS_PAGE,
  NAVBAR_CMS_PAGE,
  HOME_CMS_PAGE,
  RESERVATION_CMS_PAGE,
  SUITES_CMS_PAGE,
};

export const CMS_PAGES: readonly CmsPageSpec[] = [
  HOME_CMS_PAGE,
  URLS_CMS_PAGE,
  LEGAL_CMS_PAGE,
  CONCEPT_CMS_PAGE,
  SUITES_CMS_PAGE,
  BOOK_CMS_PAGE,
  FAQ_CMS_PAGE,
  CONTACT_CMS_PAGE,
  NAVBAR_CMS_PAGE,
  FOOTER_CMS_PAGE,
  RESERVATION_CMS_PAGE,
].map(withImageAltFields);

export function cmsPage(slug: string): CmsPageSpec | undefined {
  return CMS_PAGES.find((page) => page.slug === slug);
}
