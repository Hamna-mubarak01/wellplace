import type { Metadata } from "next";
import { connection } from "next/server";

import { BookingEdgeCta } from "@/components/marketing/home/booking-edge-cta";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { HomeClaims } from "@/components/marketing/home/home-claims";
import { HomeFaq } from "@/components/marketing/home/home-faq";
import { HomeGallery } from "@/components/marketing/home/home-gallery";
import { HomeHero } from "@/components/marketing/home/home-hero";
import { HomeGalleryPrelude } from "@/components/marketing/home/home-how";
import { HomeLocation } from "@/components/marketing/home/home-location";
import { HomeSuite } from "@/components/marketing/home/home-suite";
import { ReservationSlot } from "@/components/marketing/reservation-slot";
import { reservationFor } from "@/lib/config/cms/reservation-content";
import {
  EMPTY_SNAPSHOT,
  requireSetting,
  type SettingsSnapshot,
} from "@/lib/config";
import {
  MARKETING_BOOK_HREF as BOOK_HREF,
} from "@/lib/config/marketing";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import { getFaqContent, getHomeContent, getSiteChrome } from "@/lib/services/site-content";
import { loadTodayBookingStatus } from "@/lib/services/today-booking-service";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { createClient } from "@/lib/db/server";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { DEFAULT_DESCRIPTION, LAUNCH_MODE, SITE_NAME } from "@/lib/config/seo";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getHomeContent();
  return cmsPageMetadata(
    {
      title: `${SITE_NAME} — private wellness suites in Dubai`,
      description: DEFAULT_DESCRIPTION,
      path: "/",
      indexable: LAUNCH_MODE === "full",
    },
    content.seo,
  );
}

async function loadHomeSettings(): Promise<SettingsSnapshot> {
  await connection();
  try {
    const loaded = await loadPublicBookingSettings(await createClient());
    if (loaded.ok) return loaded.snapshot;

    console.error("[home] public settings unavailable:", loaded.message);
  } catch (cause) {
    console.error(
      "[home] public settings unavailable:",
      cause instanceof Error ? cause.message : "Unknown failure",
    );
  }

  return EMPTY_SNAPSHOT;
}

function HomeConfiguredSections({
  settings,
  content,
}: {
  settings: SettingsSnapshot;
  content: ResolvedHomeContent;
}) {
  const durations = requireSetting(settings, "booking.durations_hours");
  const guestsMax = requireSetting(settings, "booking.guests_max");
  const guestsMin = requireSetting(settings, "booking.guests_min");

  const minDurationHours = Math.min(...durations);
  const maxDurationHours = Math.max(...durations);

  return (
    <>
      <HomeClaims
        content={content.difference}
        minDurationHours={minDurationHours}
        maxDurationHours={maxDurationHours}
        guestsMin={guestsMin}
        guestsMax={guestsMax}
      />
      <HomeSuite bookHref={BOOK_HREF} guestsMax={guestsMax} content={content.suite} />
    </>
  );
}

export default async function Home() {
  // Resolve the homepage together: modal accessibility attributes must not be
  // added to streamed sections that React has yet to hydrate.
  const [content, faq, settings, chrome, todayStatus] = await Promise.all([
    getHomeContent(), getFaqContent(), loadHomeSettings(), getSiteChrome(), loadTodayBookingStatus(),
  ]);
  const reservation = reservationFor(chrome.reservation, "home");

  return (
    <div data-home className="flex min-h-svh flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="home-hero" />
      <main id="top" className="flex flex-1 flex-col">
        <HomeHero bookHref={BOOK_HREF} suiteHref="#suite" content={content.hero} todayStatus={todayStatus} />
        <HomeConfiguredSections settings={settings} content={content} />
        <HomeGalleryPrelude content={content.bridge} />
        <HomeGallery shots={content.gallery.shots} content={content.gallery} />
        <HomeFaq entries={faq.homeEntries} content={faq.homePreview} />
        <HomeLocation content={content.location} />
        <ReservationSlot page="home" content={reservation} />
      </main>
      <SiteFooterSlot />
      <BookingEdgeCta bookHref={BOOK_HREF} />
    </div>
  );
}
