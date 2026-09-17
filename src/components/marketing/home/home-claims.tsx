"use client";

import { MediaFrame } from "@/components/shared/media-frame";

import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Reveal } from "@/components/marketing/home/reveal";
import { ContentIcon } from "@/components/shared/content-icon";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import { Button } from "@/components/shared/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

import { useMinWidth } from "@/hooks/use-min-width";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { MARKETING_CAROUSEL_SCROLL_DURATION, MARKETING_DIFFERENCE_AUTOPLAY_MS, MARKETING_GALLERY_DESKTOP_MIN_WIDTH_PX } from "@/lib/config/marketing";

type Claim = {
  n: string;
  label: string;
  title: string;
  backLabel: string;
  backTitle: string;
  icon: string;
  image: string;
  imageAlt: string;
  meta: string;
  detail: string;
  href: string;
  action: string;
};

export interface HomeClaimsProps {
  content: ResolvedHomeContent["difference"];
  minDurationHours: number;
  maxDurationHours: number;
  guestsMin: number;
  guestsMax: number;
}

export function HomeClaims({
  content,
  minDurationHours,
  maxDurationHours,
  guestsMin,
  guestsMax,
}: HomeClaimsProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const desktop = useMinWidth(MARKETING_GALLERY_DESKTOP_MIN_WIDTH_PX);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!api) return;
    const select = () => { setSelected(api.selectedScrollSnap()); setFlippedCard(null); };
    const down = () => setPaused(true);
    const up = () => setPaused(false);
    api.on("select", select).on("pointerDown", down).on("pointerUp", up);
    return () => { api.off("select", select).off("pointerDown", down).off("pointerUp", up); };
  }, [api]);

  // [§Owner mobile carousel correction, 15 Sep] Loop only on small screens;
  // leave the reader in control during focus, dragging, or an opened card.
  useEffect(() => {
    if (!api || desktop || reducedMotion || paused || flippedCard) return;
    const timer = window.setInterval(() => {
      const node = regionRef.current;
      if (!node || document.hidden || node.contains(document.activeElement)) return;
      const bounds = node.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > 0) api.scrollNext();
    }, MARKETING_DIFFERENCE_AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [api, desktop, reducedMotion, paused, flippedCard, selected]);

  const META: readonly string[] = [
    "One booking per suite",
    `${minDurationHours}\u2013${maxDurationHours} hour sessions`,
    `${guestsMin}\u2013${guestsMax} guests`,
  ];
  const HREFS: readonly string[] = ["#suite", "#gallery", "#faq"];

  const claims: readonly Claim[] = content.cards.map((card, index) => ({
    n: String(index + 1).padStart(2, "0"),
    label: card.label,
    title: card.title,
    backLabel: card.backLabel,
    backTitle: card.backTitle,
    icon: card.icon,
    image: card.image,
    imageAlt: card.imageAlt,
    meta: META[index] ?? `${guestsMin}\u2013${guestsMax} guests`,
    detail: card.detail,
    href: HREFS[index] ?? "#suite",
    action: card.action,
  }));


  return (
    <section
      id="concept"
      className="band-panel bg-home-concept-surface py-10 transition-colors duration-500 motion-reduce:transition-none sm:py-12 md:py-24 lg:py-32"
    >
      <div className="home-floating-safe difference-container mx-auto w-full max-w-7xl px-5 xs:px-6 sm:px-10 lg:px-14">
        <Reveal className="mx-auto max-w-2xl text-center md:mx-0 md:mb-12 md:text-left lg:mb-14">
          <span className="inline-flex items-center gap-2.5 font-data text-label font-medium tracking-label text-band-accent uppercase">
            <span aria-hidden="true" className="h-0.5 w-6 bg-current" />
            {content.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-h2 leading-tight text-band-ink sm:mt-4 sm:text-h1">
            {content.title}{" "}
            <em className="font-accent font-medium text-band-accent italic">{content.accent}</em>
          </h2>
        </Reveal>

        <div ref={regionRef}>
        <Carousel
          setApi={setApi}
          opts={{ align: "center", loop: true, duration: reducedMotion ? 0 : MARKETING_CAROUSEL_SCROLL_DURATION, breakpoints: { "(min-width: 768px)": { active: false } } }}
          data-active-index={selected}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setPaused(true); }}
          onPointerLeave={() => setPaused(false)}
          aria-label="The WellPlace difference"
          className="difference-carousel cursor-grab touch-pan-y select-none active:cursor-grabbing md:cursor-auto md:select-auto"
        >
          {/* [§Owner mobile carousel correction, 15 Sep] Centered card and side previews. */}
          <CarouselContent className="ml-0 md:grid md:grid-cols-3">
            {claims.map((claim, index) => (
              <CarouselItem
                key={claim.n}
                className="basis-[88%] px-1.5 sm:basis-[82%] md:basis-auto md:px-4 lg:px-6"
              >
                <Reveal delayStep={index} className="h-full">
                  <DifferenceCard claim={claim} revealLabel={content.revealLabel} flipped={flippedCard === claim.n} onFlip={() => setFlippedCard(claim.n)} />
                </Reveal>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row md:hidden">
            <p className="font-data text-micro tracking-label text-band-muted uppercase">
              {content.swipeHint}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous difference card" onClick={() => api?.scrollPrev()} className="rounded-full shadow-none"><ChevronLeftIcon /></Button>
              <Button variant="outline" size="icon" aria-label="Next difference card" onClick={() => api?.scrollNext()} className="rounded-full shadow-none"><ChevronRightIcon /></Button>
            </div>
          </div>
        </Carousel>
        </div>
      </div>
    </section>
  );
}

function DifferenceCard({
  claim,
  revealLabel,
  flipped,
  onFlip,
}: {
  claim: Claim;
  revealLabel: string;
  flipped: boolean;
  onFlip: () => void;
}) {

  return (
    <article
      data-flipped={flipped || undefined}
      className="difference-card relative h-full min-h-(--measure-difference-card)"
    >
      <div className="difference-card-inner grid h-full min-h-(--measure-difference-card)">
        <Card className="difference-card-face difference-card-front relative overflow-hidden border border-band-line bg-scrim-ink py-0 ring-0 shadow-none">
          <MediaFrame
            src={claim.image}
            alt={claim.imageAlt}
            frameClassName="absolute inset-0 size-full"
            draggable={false}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
          <span
            aria-hidden="true"
            className="difference-card-scrim absolute inset-0"
          />
          <div className="relative flex h-full flex-col px-5 py-6 text-center md:px-8 md:py-8 md:text-left">
            <div className="flex items-start justify-end">
              <span
                aria-hidden="true"
                className="font-data text-h2 leading-none font-medium text-on-scrim/45"
              >
                {claim.n}
              </span>
            </div>

            <div className="mt-auto">
              <span className="block font-data text-micro font-medium tracking-label text-on-scrim-muted uppercase">
                {claim.label}
              </span>
              <div className="mt-2.5 flex items-end justify-center sm:min-h-(--measure-difference-title) md:justify-start">
                <CardTitle className="font-display text-h2 leading-tight text-on-scrim text-balance">
                  {claim.title}
                </CardTitle>
              </div>
              <p className="mt-3.5 font-data text-micro tracking-label text-on-scrim-muted uppercase">
                {claim.meta}
              </p>
              <div className="difference-card-reveal mt-5 justify-center md:justify-start">
                <Button
                  variant="link"
                  tone="scrim"
                  type="button"
                  onClick={onFlip}
                  className="text-small font-semibold md:justify-start"
                >
                  {revealLabel}
                  <ArrowUpRightIcon aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* [§Client shadow correction, 14 Sep] Keep the soft card shadow inside
            the flip clearance so it fades before the carousel's clipped edge. */}
        <Card className="difference-card-face difference-card-face-back border border-band-accent bg-band-deep py-0 text-band-ink ring-0 shadow-(--shadow-card-hover)">
          <span
            aria-hidden="true"
            className="absolute -top-12 -right-12 size-40 rounded-full bg-band-accent/15 blur-2xl"
          />
          <CardHeader className="relative gap-4 px-5 pt-6 text-center md:gap-5 md:px-8 md:pt-8 md:text-left">
            <div className="flex items-center justify-center gap-4 md:justify-between">
              <span className="font-data text-micro font-medium tracking-label text-band-accent uppercase">
                {claim.backLabel}
              </span>
              <ContentIcon name={claim.icon} className="size-5 shrink-0 text-band-accent" />
            </div>
            <CardTitle className="font-display text-h2 leading-tight text-band-ink">
              {claim.backTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative px-5 pb-2 text-center md:px-8 md:text-left">
            <p className="text-small leading-relaxed text-band-muted text-pretty sm:text-body">
              {claim.detail}
            </p>
          </CardContent>
          <CardFooter className="relative mt-auto justify-center border-band-line bg-band-ink/5 px-5 py-4 md:justify-start md:px-8 md:py-5">
            <Button asChild tone="accent" className="max-w-full whitespace-normal text-center md:text-left">
              <a href={claim.href} onFocus={onFlip}>
                {claim.action}
                <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </article>
  );
}
