import { publicPagePath } from "@/lib/services/site-content";
import type { Metadata } from "next";

import { ConceptFomoMotion } from "@/components/marketing/concept-fomo-motion";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { ConceptFomoStory } from "@/components/marketing/concept-fomo-story";
import { JsonLd } from "@/components/marketing/structured-data";
import { CONCEPT_PAGE_CONTENT } from "@/lib/config/concept";
import {
  MARKETING_ROUTES,
} from "@/lib/config/marketing";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { LAUNCH_MODE, SITE_NAME, breadcrumbJsonLd } from "@/lib/config/seo";
import { getConceptContent } from "@/lib/services/site-content";
import { loadTodayBookingStatus } from "@/lib/services/today-booking-service";

const ROUTE = MARKETING_ROUTES.concept;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getConceptContent();
  return cmsPageMetadata(
    {
      title: CONCEPT_PAGE_CONTENT.title,
      description: CONCEPT_PAGE_CONTENT.description,
      path: await publicPagePath(ROUTE.href),
      indexable: LAUNCH_MODE === "full",
    },
    content.seo,
  );
}

export default async function ConceptPage() {
  const [content, todayStatus] = await Promise.all([getConceptContent(), loadTodayBookingStatus()]);

  return (
    <div className="flex min-h-svh flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="concept-hero" />
      <main className="flex-1">
        <ConceptFomoMotion>
          <ConceptFomoStory content={content} todayStatus={todayStatus} />
        </ConceptFomoMotion>
      </main>
      <SiteFooterSlot />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: CONCEPT_PAGE_CONTENT.title, path: await publicPagePath(ROUTE.href) },
        ])}
      />
    </div>
  );
}
