import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Reveal } from "@/components/marketing/home/reveal";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import type { ResolvedReservation } from "@/lib/config/cms/reservation-content";

export interface ReservationSectionProps {
  content: ResolvedReservation;
  animated?: boolean;
}

export function ReservationSection({
  content,
  animated = true,
}: ReservationSectionProps) {
  const body = (
    <>
      <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
        <span aria-hidden="true" className="h-px w-8 bg-current" />
        {content.eyebrow}
      </span>
      <h2 className="mt-4 font-display text-h2 tracking-display text-on-scrim text-balance sm:mt-5 sm:text-h1 dark:text-text-primary">
        {content.title}{" "}
        <em className="font-accent font-medium text-band-accent italic">{content.accent}</em>
      </h2>
      <p className="mx-auto mt-4 max-w-measure text-small leading-relaxed text-on-scrim-muted text-pretty sm:mt-5 sm:text-body md:mx-0 dark:text-text-secondary">
        {content.body}
      </p>
      {/* [§Owner reservation image correction, 15 Sep] Back the light-theme
          button with its original surface, preserving its brand hover colors. */}
      <span className="mt-6 inline-flex w-full rounded-(--radius-button) bg-home-cta-surface xs:w-auto sm:mt-8 dark:bg-transparent">
        <Button asChild tone="brand" size="default" className="w-full xs:w-auto">
          <Link href={content.primaryHref}>
            {content.primaryLabel}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </span>
    </>
  );

  return (
    <section
      id="book"
      className="reservation-section relative isolate flex min-h-(--measure-cta-min-h) items-center overflow-hidden border-t border-border bg-(--reservation-image-surface) py-12 transition-colors duration-500 motion-reduce:transition-none sm:py-16 md:py-20 dark:border-b"
    >
      <MediaFrame
        src={content.image}
        alt=""
        sizes="100vw"
        frameClassName="absolute inset-0 -z-20"
        className="object-center contrast-100 saturate-100"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-(--reservation-image-surface)/60 md:bg-linear-to-r md:from-(--reservation-image-surface) md:from-15% md:via-(--reservation-image-surface)/68 md:to-(--reservation-image-end)/5"
      />

      <div className="home-floating-safe mx-auto w-full max-w-7xl px-5 xs:px-6 sm:px-10 lg:px-14">
        {animated ? (
          <Reveal className="mx-auto max-w-2xl text-center md:mx-0 md:text-left">
            {body}
          </Reveal>
        ) : (
          <div className="mx-auto max-w-2xl text-center md:mx-0 md:text-left">
            {body}
          </div>
        )}
      </div>
    </section>
  );
}
