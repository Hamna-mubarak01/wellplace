import { resolvePublicUrls, publicUrl } from "@/lib/config/cms/public-urls";
import { getSetting } from "@/lib/config";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { resolveLegalContent } from "@/lib/config/cms/legal-content";
import { readSiteCms, readSiteCmsMany } from "@/lib/services/cms-preview";
import { cache } from "react";
import { connection } from "next/server";

import {
  resolveBookingContent,
  type ResolvedBookingContent,
} from "@/lib/config/cms/book-content";
import {
  resolveContactContent,
  type ResolvedContactContent,
} from "@/lib/config/cms/contact-content";
import {
  resolveConceptContent,
  type ResolvedConceptContent,
} from "@/lib/config/cms/concept-content";
import {
  resolveFaqContent,
  type ResolvedFaqContent,
} from "@/lib/config/cms/faq-content";
import {
  resolveHomeContent,
  type ResolvedHomeContent,
} from "@/lib/config/cms/home-content";
import {
  resolveSuitesContent,
  type ResolvedSuitesContent,
} from "@/lib/config/cms/suites-content";
import {
  resolveFooterContent,
  resolveNavbarContent,
  type ResolvedFooter,
  type ResolvedNavbar,
} from "@/lib/config/cms/site-chrome-content";
import {
  resolveReservationContent,
  type ResolvedReservationContent,
} from "@/lib/config/cms/reservation-content";
import { createClient } from "@/lib/db/server";

const CHROME_SLUGS = ["reservation", "faq", "navbar", "footer", "home", "urls"] as const;

function unavailable(slug: string, cause: unknown): void {
  console.error(
    `[cms] published ${slug} content unavailable, using built-in copy:`,
    cause instanceof Error ? cause.message : "Unknown failure",
  );
}

async function loadHomeContent(): Promise<ResolvedHomeContent> {
  await connection();
  try {
    const published = await readSiteCms(await createClient(), "home");
    const content = resolveHomeContent(published);
    const settings = await loadPublicBookingSettings(await createClient());
    const address = settings.ok ? getSetting(settings.snapshot, "contact.address") : null;
    if (!address) return content;
    const addressLines = address.split("\n").filter(Boolean);
    const query = encodeURIComponent(addressLines.join(", "));
    return { ...content, location: { ...content.location, addressLines,
      mapLink: `https://www.google.com/maps/search/?api=1&query=${query}`,
      directionsLink: `https://www.google.com/maps/dir/?api=1&destination=${query}` } };
  } catch (cause) {
    unavailable("home", cause);
    return resolveHomeContent(null);
  }
}

export interface SiteChrome {
  readonly reservation: ResolvedReservationContent;
  readonly faq: ResolvedFaqContent;
  readonly navbar: ResolvedNavbar;
  readonly footer: ResolvedFooter;
}

async function loadSiteChrome(): Promise<SiteChrome> {
  await connection();
  try {
    const published = await readSiteCmsMany(
      await createClient(),
      CHROME_SLUGS,
    );
    const navbar = resolveNavbarContent(published.get("navbar") ?? null);
    const rules = resolvePublicUrls(published.get("urls") ?? null);
    const resolvedNavbar = rules.error ? navbar : { ...navbar, links: navbar.links.map((link) => ({ ...link, href: publicUrl(link.href, rules.pages) })) };
    return {
      reservation: resolveReservationContent(published.get("reservation") ?? null),
      faq: resolveFaqContent(published.get("faq") ?? null, published.get("home")),
      navbar: resolvedNavbar,
      footer: resolveFooterContent(published.get("footer") ?? null),
    };
  } catch (cause) {
    unavailable("site chrome", cause);
    return {
      reservation: resolveReservationContent(null),
      faq: resolveFaqContent(null),
      navbar: resolveNavbarContent(null),
      footer: resolveFooterContent(null),
    };
  }
}

async function loadConceptContent(): Promise<ResolvedConceptContent> {
  await connection();
  try {
    const published = await readSiteCms(await createClient(), "concept");
    return resolveConceptContent(published);
  } catch (cause) {
    unavailable("concept", cause);
    return resolveConceptContent(null);
  }
}

async function loadSuitesContent(): Promise<ResolvedSuitesContent> {
  await connection();
  try {
    const published = await readSiteCms(await createClient(), "suites");
    return resolveSuitesContent(published);
  } catch (cause) {
    unavailable("suites", cause);
    return resolveSuitesContent(null);
  }
}

async function loadBookingContent(): Promise<ResolvedBookingContent> {
  await connection();
  try {
    const published = await readSiteCms(await createClient(), "book");
    return resolveBookingContent(published);
  } catch (cause) {
    unavailable("book", cause);
    return resolveBookingContent(null);
  }
}

async function loadContactContent(): Promise<ResolvedContactContent> {
  await connection();
  try {
    const published = await readSiteCms(await createClient(), "contact");
    return resolveContactContent(published);
  } catch (cause) {
    unavailable("contact", cause);
    return resolveContactContent(null);
  }
}

export const getHomeContent = cache(loadHomeContent);
export const getContactContent = cache(loadContactContent);
export const getBookingContent = cache(loadBookingContent);
export const getConceptContent = cache(loadConceptContent);
export const getSuitesContent = cache(loadSuitesContent);
export const getSiteChrome = cache(loadSiteChrome);


export async function getFaqContent(): Promise<ResolvedFaqContent> {
  return (await getSiteChrome()).faq;
}

export const getLegalContent = cache(async () => {
  await connection();
  return resolveLegalContent(await readSiteCms(await createClient(), "legal"));
});

export const publicPagePath = cache(async (path: string): Promise<string> => {
  try {
    const rules = resolvePublicUrls(await readSiteCms(await createClient(), "urls"));
    return rules.error ? path : publicUrl(path, rules.pages);
  } catch { return path; }
});
