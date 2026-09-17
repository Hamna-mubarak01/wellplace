import { publicPagePath } from "@/lib/services/site-content";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { FaqKnowledgeBase } from "@/components/marketing/faq-knowledge-base";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { ReservationSlot } from "@/components/marketing/reservation-slot";
import { JsonLd } from "@/components/marketing/structured-data";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { FAQ_PAGE_CONTENT } from "@/lib/config/faq";
import { LAUNCH_MODE, SITE_NAME, breadcrumbJsonLd, faqJsonLd } from "@/lib/config/seo";
import { getFaqContent } from "@/lib/services/site-content";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getFaqContent();
  return cmsPageMetadata(
    {
      title: FAQ_PAGE_CONTENT.title,
      description: FAQ_PAGE_CONTENT.description,
      path: await publicPagePath("/faq"),
      indexable: LAUNCH_MODE === "full",
    },
    content.seo,
  );
}

export default async function FaqPage() {
  const content = await getFaqContent();
  const { hero } = content;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="faq-hero" />
      <main className="flex-1">
        <section
          id="faq-hero"
          className="relative isolate flex min-h-hero-media items-center overflow-hidden bg-home-hero-surface px-5 pt-nav text-band-ink xs:px-6 sm:px-10 lg:px-14"
        >
          <MediaFrame
            src={content.homePreview.image}
            alt=""
            sizes="100vw"
            preload
            frameClassName="absolute inset-0 -z-30"
            className="object-center"
          />
          <span aria-hidden="true" className="absolute inset-0 -z-20 bg-band-deep/55" />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-b from-band-deep/40 via-band-deep/55 to-band-deep/85"
          />
          <header className="mx-auto w-full max-w-3xl py-16 text-center sm:py-20">
            <h1 className="font-display text-display leading-none tracking-display text-band-ink text-balance">
              {hero.title}
              <em className="block font-accent font-medium text-band-accent italic">
                {hero.accent}
              </em>
            </h1>
            <p className="mx-auto mt-5 max-w-measure text-small leading-relaxed text-band-muted text-pretty sm:mt-6 sm:text-lead">
              {hero.body}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 xs:flex-row sm:mt-8">
              <Button asChild tone="band-accent" size="lg" className="min-h-tap shadow-(--shadow-md)">
                <Link href={hero.primaryHref}>
                  {hero.primaryLabel}
                  <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild tone="band-scrim" size="lg" className="min-h-tap shadow-(--shadow-md) backdrop-blur-md">
                <Link href={hero.secondaryHref}>{hero.secondaryLabel}</Link>
              </Button>
            </div>
          </header>
        </section>

        <section className="bg-surface-base px-5 pt-12 pb-16 transition-colors duration-500 motion-reduce:transition-none xs:px-6 sm:px-10 sm:pt-14 sm:pb-20 lg:px-14 lg:pt-16 lg:pb-28">
          <div className="mx-auto w-full max-w-6xl">
            {content.groups.length === 0 ? (
              <p className="text-center text-body text-text-secondary text-pretty">
                {content.emptyLabel}
              </p>
            ) : (
              <FaqKnowledgeBase groups={content.groups} />
            )}
          </div>
        </section>
        <ReservationSlot page="faq" />
      </main>
      <SiteFooterSlot />
      {content.answered.length > 0 && <JsonLd data={faqJsonLd(content.answered)} />}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: FAQ_PAGE_CONTENT.title, path: "/faq" },
        ])}
      />
    </div>
  );
}
