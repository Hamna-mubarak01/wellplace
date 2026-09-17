import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import {
  HeroSlideshow,
  type HeroSlide,
} from "@/components/marketing/hero-slideshow";
import { Reveal } from "@/components/marketing/home/reveal";
import { TodayBookingCountdown } from "@/components/marketing/today-booking-countdown";
import { Button } from "@/components/shared/button";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import type { TodayBookingStatus } from "@/lib/services/today-booking-service";

const HERO_FOCUS: readonly string[] = [
  "50% 50%",
  "50% 54%",
  "52% 48%",
  "54% 48%",
  "50% 54%",
];

export interface HomeHeroProps {
  bookHref: string;
  suiteHref: string;
  content: ResolvedHomeContent["hero"];
  todayStatus?: TodayBookingStatus | null;
}

export function HomeHero({ bookHref, suiteHref, content, todayStatus }: HomeHeroProps) {
  const slides: readonly HeroSlide[] = content.slides
    .map((item, index) => ({
      src: item.url,
      kind: item.kind,
      poster: content.poster,
      focus: HERO_FOCUS[index % HERO_FOCUS.length] ?? "50% 50%",
    }));

  return (
    <section
      id="home-hero"
      className="relative isolate min-h-svh overflow-hidden bg-home-hero-surface text-band-ink transition-colors duration-500 motion-reduce:transition-none"
    >
      <HeroSlideshow
        label={content.mediaLabel}
        slides={slides}
        sizes="100vw"
        className="absolute inset-0 -z-30"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-band-deep/70"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-b from-band-deep/70 via-band-deep/30 to-band-deep/85"
      />

      <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col items-center justify-center px-5 pt-nav pb-10 text-center xs:px-6 sm:px-10 sm:pb-24 lg:px-14">
        {todayStatus ? (
          <TodayBookingCountdown status={todayStatus} bookHref={bookHref} refresh tone="band" className="mb-6 sm:mb-8" />
        ) : null}

        <Reveal delayStep={1} className="max-w-4xl">
          <h1 className="mt-5 font-display text-display leading-none text-band-ink text-balance sm:mt-7">
            {content.title}
            <br />
            <em className="font-accent font-medium text-band-accent italic">
              {content.accent}
            </em>
          </h1>
        </Reveal>

        <Reveal delayStep={2} className="max-w-xl sm:max-w-2xl">
          <p className="mt-5 text-small leading-relaxed text-band-muted text-pretty sm:mt-7 sm:text-lead">
            {content.body}
          </p>
        </Reveal>

        <div className="mt-7 grid w-full max-w-sm grid-cols-1 gap-3 xs:grid-cols-2 sm:mt-9 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-3.5">
          <Button
            asChild
            tone="accent"
            size="lg"
            className="home-hero-action-primary min-h-tap w-full px-5 shadow-(--shadow-md) backdrop-blur-md sm:w-auto sm:px-7"
          >
            <Link href={bookHref}>
              {content.primaryLabel}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            asChild
            tone="scrim"
            size="lg"
            className="home-hero-action-secondary min-h-tap w-full px-5 shadow-(--shadow-md) backdrop-blur-md sm:w-auto sm:px-7"
          >
            <a href={suiteHref}>
              {content.secondaryLabel}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
