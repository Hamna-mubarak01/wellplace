"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  DropletsIcon,
  SlidersHorizontalIcon,
  SofaIcon,
  ThermometerSunIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Reveal } from "@/components/marketing/home/reveal";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import { MARKETING_SUITE_ROTATION_MS } from "@/lib/config/marketing";
import { cn } from "@/lib/utils";

export interface HomeSuiteProps {
  bookHref: string;
  guestsMax: number;
  content: ResolvedHomeContent["suite"];
}

export function HomeSuite({ bookHref, content }: HomeSuiteProps) {
  const VIEW_ICONS = [SofaIcon, ThermometerSunIcon, SlidersHorizontalIcon, DropletsIcon];

  const suiteViews = content.views.map((view, index) => ({
    id: view.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `view-${index}`,
    label: view.label,
    src: view.image,
    alt: view.imageAlt,
    title: view.title,
    emphasis: view.emphasis,
    body: view.body,
    Icon: VIEW_ICONS[index % VIEW_ICONS.length] ?? SofaIcon,
    detailTitle: view.detailTitle,
    detailBody: view.detailBody,
  }));

  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [rotationEpoch, setRotationEpoch] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || reducedMotion) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) api.scrollNext();
    }, MARKETING_SUITE_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [api, reducedMotion, rotationEpoch, selected]);

  const selectView = useCallback(
    (index: number) => {
      setRotationEpoch((current) => current + 1);
      api?.scrollTo(index);
    },
    [api],
  );
  const selectedView = suiteViews[selected] ?? suiteViews[0];

  return (
    <section
      id="suite"
      className="bg-home-suite-surface py-8 transition-colors duration-500 motion-reduce:transition-none sm:py-16 md:py-24 lg:py-32"
    >
      <div className="home-floating-safe mx-auto w-full max-w-7xl px-5 xs:px-6 sm:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-2 sm:gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal>
            <div className="h-suite-carousel overflow-hidden rounded-(--radius-modal) border border-border bg-surface-sunken shadow-(--shadow-lg) lg:h-suite-showcase">
              <Carousel
                setApi={setApi}
                opts={{ loop: true, duration: reducedMotion ? 0 : undefined }}
                aria-label="Inside a WellPlace suite"
                className="suite-carousel size-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
              >
                <CarouselContent className="ml-0">
                  {suiteViews.map((view) => (
                    <CarouselItem key={view.id} className="pl-0">
                      <MediaFrame
                        src={view.src}
                        alt={view.alt}
                        draggable={false}
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        frameClassName="size-full"
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>

            <div className="mt-1 flex min-h-tap items-center justify-center sm:mt-3">
              <div
                role="group"
                aria-label="Choose a suite view"
                className="flex items-center justify-center"
              >
                {suiteViews.map((view, index) => (
                  <Button
                    key={view.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => selectView(index)}
                    aria-label={
                      index === selected
                        ? `${view.label}, current suite view`
                        : `Show ${view.label} suite view`
                    }
                    aria-current={index === selected || undefined}
                    className="suite-carousel-marker h-tap w-auto cursor-pointer rounded-full px-1.5 py-0"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative h-0.5 overflow-hidden rounded-full bg-border-strong transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none",
                        index === selected ? "w-20" : "w-2.5",
                      )}
                    >
                      {index === selected && (
                        <span
                          key={`${selected}-${rotationEpoch}`}
                          className={cn(
                            "absolute inset-y-0 left-0 w-full origin-left rounded-full bg-brand",
                            !reducedMotion && "suite-carousel-progress",
                          )}
                          style={{ animationDuration: `${MARKETING_SUITE_ROTATION_MS}ms` }}
                        />
                      )}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal
            delayStep={1}
            className="flex flex-col items-center justify-center text-center lg:min-h-suite-showcase"
          >
            <div
              key={selectedView.id}
              className="animate-in w-full duration-500 fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none"
            >
              <span className="font-data text-label font-medium tracking-label text-brand uppercase">
                {content.eyebrow}
              </span>

              <div aria-hidden="true" className="mx-auto mt-2 flex max-w-sm items-center gap-3 sm:mt-5 sm:gap-4">
                <span className="h-px flex-1 bg-border" />
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-raised shadow-(--shadow-xs) sm:size-11">
                  <selectedView.Icon className="size-4.5 text-brand sm:size-5" />
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <h2 className="mt-3 font-display text-h2 leading-tight text-text-primary sm:mt-6 sm:text-h1">
                {selectedView.title}{" "}
                <em className="font-accent font-medium text-brand italic">
                  {selectedView.emphasis}
                </em>
              </h2>
              <p className="mx-auto mt-2.5 max-w-measure text-small leading-relaxed text-text-secondary text-pretty sm:mt-4 sm:text-lead">
                {selectedView.body}
              </p>

              <div className="mx-auto mt-5 max-w-sm border-y border-border py-3.5 sm:mt-7 sm:py-5">
                <h3 className="text-small font-medium text-text-primary sm:text-body">
                  {selectedView.detailTitle}
                </h3>
                <p className="mt-2 text-small text-text-secondary text-pretty">
                  {selectedView.detailBody}
                </p>
              </div>
            </div>

            <Button
              asChild
              tone="brand"
              variant="outline"
              size="default"
              className="mt-5 h-auto min-h-control w-full whitespace-normal py-3 xs:w-auto sm:mt-7"
            >
              <Link href={bookHref}>
                {content.ctaLabel}
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
