import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { Reveal } from "@/components/marketing/home/reveal";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import type { ResolvedFaqContent } from "@/lib/config/cms/faq-content";
import type { MarketingFaqEntry } from "@/lib/config/faq";

export interface HomeFaqProps {
  entries: readonly MarketingFaqEntry[];
  content: ResolvedFaqContent["homePreview"];
}

export function HomeFaq({ entries, content }: HomeFaqProps) {
  return (
    <section
      id="faq"
      className="relative z-10 bg-home-faq-surface py-14 transition-colors duration-500 motion-reduce:transition-none sm:py-20 md:py-24 lg:py-32"
    >
      {/* [§Owner Home FAQ reference, 15 Sep] Image beside the questions, stacked on mobile. */}
      <div className="home-floating-safe mx-auto grid w-full max-w-7xl items-start gap-8 px-[calc(var(--measure-booking-edge-w)+var(--space-booking-edge-clearance))] sm:gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-stretch lg:gap-10 xl:gap-14">
        <Reveal className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <MediaFrame
            src={content.image}
            alt={content.imageAlt}
            sizes="(min-width: 1280px) 480px, (min-width: 1024px) 40vw, (min-width: 640px) 576px, 80vw"
            frameClassName="aspect-4/3 rounded-(--radius-modal) sm:aspect-square lg:absolute lg:inset-0 lg:size-full lg:aspect-auto"
          />
        </Reveal>

        <Reveal delayStep={1} className="min-w-0">
          <div className="text-center lg:text-left">
            <p className="mb-3 font-data text-label font-medium tracking-label text-brand uppercase">{content.eyebrow}</p>
            <h2 className="font-display text-h2 leading-tight text-text-primary sm:text-h1">
              {content.title}{" "}
              <em className="font-accent font-medium text-brand italic">{content.accent}</em>
            </h2>
            <p className="mt-3 text-small text-text-secondary text-pretty">
              {content.body}
            </p>
          </div>
          {entries.length > 0 && (
            <FaqAccordion
              variant="lined"
              entries={entries}
              className="mt-6 sm:mt-8"
            />
          )}
          <div className="mt-6 flex justify-center sm:mt-7 lg:justify-start">
            <Button asChild tone="brand" variant="outline" size="sm" className="w-full xs:w-auto">
              <Link href="/faq">
                {content.linkLabel}
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
