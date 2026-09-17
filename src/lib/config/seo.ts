import type { Metadata } from "next";

import { BRAND_ASSETS } from "@/components/shared/wordmark";
import {
  VENUE_ADDRESS_LINES,
  VENUE_MAP_LINK,
} from "@/lib/config/entity";

export const SITE_NAME = "WellPlace";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://wellplace.example";

export const LOCALE = "en_AE";

export type LaunchMode = "waitlist" | "full";

export const LAUNCH_MODE: LaunchMode =
  process.env.NEXT_PUBLIC_LAUNCH_MODE === "full" ? "full" : "waitlist";

export const IS_PRODUCTION = process.env.NEXT_PUBLIC_APP_ENV === "production";

export const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION;

export const OG_IMAGE = {
  url: "/og/wellplace.jpg",
  width: 1200,
  height: 630,
  alt: "A WellPlace suite in warm timber and stone.",
} as const;

export const FOOTER_DESCRIPTION =
  "Wellness Made Private. WellPlace brings a new kind of wellness experience to Dubai, with fully private suites created for uninterrupted time, complete freedom and a space shared only with the people you choose.";

export const DEFAULT_DESCRIPTION =
  "A new kind of wellness experience in Dubai: fully private suites created for uninterrupted time, complete freedom and a space shared only with the people you choose.";

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export interface OpenGraphImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export interface PageSeo {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
  image?: OpenGraphImage;
}

export function pageMetadata({
  title,
  description,
  path,
  indexable = true,
  image = OG_IMAGE,
}: PageSeo): Metadata {
  const socialTitle = path === "/" ? title : `${title} · ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: indexable
      ? undefined
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: path,
      title: socialTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image.url],
    },
  };
}

export function organisationJsonLd(addressLines: readonly string[] = VENUE_ADDRESS_LINES) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en-AE",
        publisher: { "@id": `${SITE_URL}/#organisation` },
      },
      {
        "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
        "@id": `${SITE_URL}/#organisation`,
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        image: absoluteUrl(OG_IMAGE.url),
        logo: absoluteUrl(BRAND_ASSETS.logo),
        address: {
          "@type": "PostalAddress",
          streetAddress: addressLines.slice(0, 3).join(", "),
          addressLocality: "Dubai",
          addressRegion: "Dubai",
          addressCountry: "AE",
        },
        hasMap: VENUE_MAP_LINK,
        areaServed: { "@type": "City", name: "Dubai" },
        currenciesAccepted: "AED",
      },
    ],
  };
}

export interface SeoFaqEntry {
  readonly q: string;
  readonly a: string;
}

export function faqJsonLd(entries: readonly SeoFaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.a,
      },
    })),
  };
}

export interface BreadcrumbItem {
  readonly name: string;
  readonly path: string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
