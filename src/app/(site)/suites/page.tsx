import { publicPagePath } from "@/lib/services/site-content";
import type { Metadata } from "next";
import { connection } from "next/server";

import { SuitesExperience } from "@/components/marketing/suites-experience";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { ReservationSlot } from "@/components/marketing/reservation-slot";
import { JsonLd } from "@/components/marketing/structured-data";
import {
  MARKETING_ROUTES,
} from "@/lib/config/marketing";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { EMPTY_SNAPSHOT, getSetting, type SettingsSnapshot } from "@/lib/config";
import type { SuiteFacts } from "@/lib/config/suites";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { createClient } from "@/lib/db/server";
import { LAUNCH_MODE, SITE_NAME, breadcrumbJsonLd } from "@/lib/config/seo";
import { getSuitesContent } from "@/lib/services/site-content";
import { SUITES_PAGE_CONTENT } from "@/lib/config/suites";

const ROUTE = MARKETING_ROUTES.suites;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSuitesContent();
  return cmsPageMetadata(
    {
      title: SUITES_PAGE_CONTENT.title,
      description: SUITES_PAGE_CONTENT.description,
      path: await publicPagePath(ROUTE.href),
      indexable: LAUNCH_MODE === "full",
    },
    content.seo,
  );
}

async function loadSuitesSettings(): Promise<SettingsSnapshot> {
  await connection();
  try {
    const loaded = await loadPublicBookingSettings(await createClient());
    if (loaded.ok) return loaded.snapshot;
    console.error("[suites] public settings unavailable:", loaded.message);
  } catch (cause) {
    console.error(
      "[suites] public settings unavailable:",
      cause instanceof Error ? cause.message : "Unknown failure",
    );
  }
  return EMPTY_SNAPSHOT;
}

function suiteFacts(settings: SettingsSnapshot): SuiteFacts {
  const hours = getSetting(settings, "booking.durations_hours");
  return { hours: hours?.length ? hours : null };
}

export default async function SuitesPage() {
  const [content, settings] = await Promise.all([getSuitesContent(), loadSuitesSettings()]);

  return (
    <div className="flex min-h-svh flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="suites-hero" />
      <main className="flex-1">
        <SuitesExperience content={content} facts={suiteFacts(settings)} />
        <ReservationSlot page="suites" />
      </main>
      <SiteFooterSlot />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: SUITES_PAGE_CONTENT.title, path: await publicPagePath(ROUTE.href) },
        ])}
      />
    </div>
  );
}
