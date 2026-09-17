"use client";

import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, XIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Reveal } from "@/components/marketing/home/reveal";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useMinWidth } from "@/hooks/use-min-width";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import {
  MARKETING_GALLERY_AUTOPLAY_MS,
  MARKETING_GALLERY_DESKTOP_MIN_WIDTH_PX,
  MARKETING_GALLERY_DEPTH,
  MARKETING_CAROUSEL_SCROLL_DURATION,
  MARKETING_GALLERY_MAX_IMAGES,
  MARKETING_GALLERY_SWAY_PERCENT,
  MARKETING_GALLERY_SWIPE_PX,
  galleryOffset,
} from "@/lib/config/marketing";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface GalleryShot {
  src: string;
  alt: string;
  orientation: "landscape" | "portrait";
}

export interface HomeGalleryProps {
  shots: readonly GalleryShot[];
}

// [§Owner responsive correction, 15 Sep] Desktop deck; original mobile swipe layout.
export function HomeGallery({
  shots: suppliedShots,
  content,
}: HomeGalleryProps & { content: ResolvedHomeContent["gallery"] }) {
  const shots = suppliedShots.slice(0, MARKETING_GALLERY_MAX_IMAGES);
  const count = shots.length;
  const [selected, setSelected] = useState(0);
  const [mobileApi, setMobileApi] = useState<CarouselApi>();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [touching, setTouching] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const centerButtonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const desktop = useMinWidth(MARKETING_GALLERY_DESKTOP_MIN_WIDTH_PX);
  const depth = MARKETING_GALLERY_DEPTH;
  const active = count ? selected % count : 0;
  const open = openIndex === null ? null : shots[openIndex % count];
  const rotating = count > 1 && !reducedMotion && !touching && openIndex === null;

  useEffect(() => {
    if (!mobileApi || desktop) return;
    const select = () => setSelected(mobileApi.selectedScrollSnap());
    const down = () => setTouching(true);
    const up = () => setTouching(false);
    const frame = window.requestAnimationFrame(select);
    mobileApi.on("select", select).on("reInit", select).on("pointerDown", down).on("pointerUp", up);
    return () => {
      window.cancelAnimationFrame(frame);
      mobileApi.off("select", select).off("reInit", select).off("pointerDown", down).off("pointerUp", up);
    };
  }, [mobileApi, desktop]);

  useGSAP(
    () => {
      const stage = stageRef.current;
      if (!stage) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: 0.8, invalidateOnRefresh: true } })
          .to(stage, { xPercent: MARKETING_GALLERY_SWAY_PERCENT, ease: "sine.inOut", duration: 1 })
          .to(stage, { xPercent: -MARKETING_GALLERY_SWAY_PERCENT, ease: "sine.inOut", duration: 2 })
          .to(stage, { xPercent: 0, ease: "sine.inOut", duration: 1 });
      });
      return () => media.revert();
    },
    { scope: stageRef, dependencies: [desktop, count] },
  );

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      if (desktop) setSelected((current) => (current + 1) % count);
      else mobileApi?.scrollNext();
    }, MARKETING_GALLERY_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, count, rotating, desktop, mobileApi]);

  const navigate = (direction: -1 | 1) => {
    if (count > 1) setSelected((current) => (current + direction + count) % count);
  };

  const movePreview = (direction: -1 | 1) => {
    if (openIndex === null || !count) return;
    const next = (openIndex + direction + count) % count;
    setOpenIndex(next);
    setSelected(next);
    if (!desktop) mobileApi?.scrollTo(next, true);
  };

  if (!count) return null;

  return (
    <section id="gallery" className="gallery-overlap relative z-10 overflow-hidden rounded-t-(--radius-band) border-t border-border bg-home-gallery-surface py-10 shadow-(--shadow-lg) transition-colors duration-500 motion-reduce:transition-none sm:py-14 md:py-16">
      <div className="home-floating-safe mx-auto w-full max-w-7xl px-[calc(var(--measure-booking-edge-w)+var(--space-booking-edge-clearance))]">
        <Reveal className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
          <span className="inline-flex items-center gap-2.5 font-data text-label font-medium tracking-label text-brand uppercase">
            <span aria-hidden="true" className="h-0.5 w-6 bg-current" />
            {content.eyebrow}
          </span>
          <h2 className="mt-3 font-display text-h2 leading-tight text-text-primary sm:mt-4 sm:text-h1">
            {content.title}{" "}<em className="font-accent font-medium text-brand italic">{content.accent}</em>
          </h2>
          <p className="mx-auto mt-4 max-w-measure text-small text-text-secondary text-pretty sm:text-body">{content.body}</p>
        </Reveal>

        <div
          ref={stageRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="WellPlace gallery"
          onKeyDown={(event) => {
            if (!desktop || !event.currentTarget.contains(event.target as Node)) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              navigate(event.key === "ArrowLeft" ? -1 : 1);
              if (event.target instanceof Element && event.target.closest(".gallery-deck-image")) {
                requestAnimationFrame(() => centerButtonRef.current?.focus());
              }
            }
          }}
        >
          {desktop ? <div
            id="gallery-deck"
            className="gallery-deck relative isolate touch-pan-y select-none"
            data-active-index={active}
            aria-live={rotating ? "off" : "polite"}
            onTouchStart={(event) => {
              setTouching(true);
              const touch = event.touches[0];
              touchStart.current = { x: touch.clientX, y: touch.clientY };
              swiped.current = false;
            }}
            onTouchEnd={(event) => {
              setTouching(false);
              if (!touchStart.current) return;
              const touch = event.changedTouches[0];
              const dx = touch.clientX - touchStart.current.x;
              const dy = touch.clientY - touchStart.current.y;
              touchStart.current = null;
              if (Math.abs(dx) >= MARKETING_GALLERY_SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
                swiped.current = true;
                navigate(dx < 0 ? 1 : -1);
              }
            }}
            onTouchCancel={() => { touchStart.current = null; setTouching(false); }}
            onClickCapture={(event) => {
              if (swiped.current) { event.preventDefault(); event.stopPropagation(); swiped.current = false; }
            }}
          >
            {shots.map((shot, index) => {
              const offset = galleryOffset(index, active, count);
              const distance = Math.abs(offset);
              const visible = distance <= depth;
              const centered = index === active;
              return (
                <div
                  key={`${shot.src}-${index}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${count}`}
                  aria-hidden={!visible}
                  inert={!visible}
                  data-distance={distance}
                  data-center={centered || undefined}
                  data-visible={visible || undefined}
                  style={{ "--gallery-offset": offset, "--gallery-depth": distance, zIndex: count - distance } as CSSProperties}
                  className="gallery-deck-card absolute overflow-hidden rounded-(--radius-modal) border border-border bg-surface-sunken shadow-(--shadow-card-hover)"
                >
                  <Button
                    ref={centered ? centerButtonRef : undefined}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={centered ? `Open larger view: ${shot.alt}` : `Show image ${index + 1}: ${shot.alt}`}
                    tabIndex={visible ? 0 : -1}
                    onClick={() => { if (centered) setOpenIndex(index); else setSelected(index); }}
                    className="gallery-deck-image size-full rounded-(--radius-modal) p-0"
                  >
                    <MediaFrame src={shot.src} alt={shot.alt} sizes="(max-width: 767px) 75vw, (max-width: 1280px) 70vw, 900px" draggable={false} frameClassName="absolute inset-0 size-full" />
                    {centered && (
                      <span aria-hidden="true" className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full border border-band-line bg-scrim-ink/65 text-on-scrim backdrop-blur-sm">
                        <MaximizeIcon className="size-4" />
                      </span>
                    )}
                  </Button>
                </div>
              );
            })}
          </div> : (
            <Carousel
              setApi={setMobileApi}
              opts={{ align: "center", loop: true, duration: reducedMotion ? 0 : MARKETING_CAROUSEL_SCROLL_DURATION }}
              aria-label="Gallery images"
              className="gallery-mobile-carousel cursor-grab touch-pan-y select-none active:cursor-grabbing"
              data-active-index={active}
            >
              <CarouselContent className="ml-0 py-5 sm:py-7">
                {shots.map((shot, index) => (
                  <CarouselItem key={`${shot.src}-${index}`} data-active={index === active || undefined} className="gallery-mobile-slide basis-[78%] pl-0 sm:basis-[68%]">
                    <div data-active={index === active || undefined} className="gallery-mobile-card relative aspect-4/5">
                      <Button
                        ref={index === active ? centerButtonRef : undefined}
                        variant="ghost"
                        size="icon"
                        aria-label={`Open larger view: ${shot.alt}`}
                        onClick={() => { mobileApi?.scrollTo(index, true); setOpenIndex(index); }}
                        className="gallery-mobile-image relative overflow-hidden rounded-(--radius-modal) border border-border p-0 shadow-(--shadow-card-hover)"
                      >
                        <MediaFrame src={shot.src} alt={shot.alt} sizes="(max-width: 767px) 75vw, 900px" draggable={false} frameClassName="absolute inset-0 size-full" />
                        <span aria-hidden="true" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full border border-band-line bg-scrim-ink/65 text-on-scrim backdrop-blur-sm"><MaximizeIcon className="size-4" /></span>
                      </Button>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                <p aria-live={rotating ? "off" : "polite"} className="flex items-baseline gap-2 font-data text-text-muted">
                  <span className="text-h3 text-text-primary">{String(active + 1).padStart(2, "0")}</span>
                  <span className="text-micro tracking-label uppercase">of {String(count).padStart(2, "0")}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label="Previous gallery image" onClick={() => mobileApi?.scrollPrev()}><ChevronLeftIcon /></Button>
                  <Button variant="outline" size="icon" aria-label="Next gallery image" onClick={() => mobileApi?.scrollNext()}><ChevronRightIcon /></Button>
                </div>
              </div>
            </Carousel>
          )}
        </div>
      </div>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpenIndex(null)}>
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            centerButtonRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); movePreview(-1); }
            if (event.key === "ArrowRight") { event.preventDefault(); movePreview(1); }
          }}
          className="fixed inset-0 top-0 left-0 grid h-svh w-screen max-w-none translate-x-0 translate-y-0 grid-cols-1 grid-rows-1 place-items-center gap-0 overflow-hidden rounded-none border-0 bg-scrim-ink/95 p-0 shadow-none ring-0 backdrop-blur-md sm:max-w-none"
        >
          <DialogTitle className="sr-only">
            {open?.alt || content.viewerCaption}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {content.viewerCaption}
          </DialogDescription>
          {open ? (
            <div className="relative flex size-full min-h-0 min-w-0 items-center justify-center p-3 sm:p-6 lg:p-10">
              <div className="animate-in relative size-full min-h-0 min-w-0 overflow-hidden rounded-(--radius-card) duration-500 fade-in-0 zoom-in-95 motion-reduce:animate-none">
                <MediaFrame
                  key={open.src}
                  src={open.src}
                  alt={open.alt}
                  sizes="100vw"
                  preload
                  frameClassName="size-full bg-transparent"
                  className="object-contain"
                />
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Back to gallery"
                  tone="scrim"
                  className="gallery-lightbox-control absolute top-4 left-4 size-tap shadow-(--shadow-md) backdrop-blur-sm"
                >
                  <ArrowLeftIcon aria-hidden="true" />
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Previous image"
                onClick={() => movePreview(-1)}
                tone="scrim"
                className="gallery-lightbox-control absolute bottom-4 left-4 size-tap shadow-(--shadow-md) backdrop-blur-sm sm:top-1/2 sm:bottom-auto sm:left-6 sm:-translate-y-1/2"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                aria-label="Next image"
                onClick={() => movePreview(1)}
                tone="scrim"
                className="gallery-lightbox-control absolute right-4 bottom-4 size-tap shadow-(--shadow-md) backdrop-blur-sm sm:top-1/2 sm:right-6 sm:bottom-auto sm:-translate-y-1/2"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
              <span
                aria-hidden="true"
                className="absolute bottom-7 left-1/2 -translate-x-1/2 font-data text-micro tracking-label text-on-scrim-muted sm:hidden"
              >
                {String((openIndex ?? 0) + 1).padStart(2, "0")} / {String(shots.length).padStart(2, "0")}
              </span>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Close gallery"
                  tone="scrim"
                  className="gallery-lightbox-control absolute top-4 right-4 size-tap shadow-(--shadow-md) backdrop-blur-sm"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </DialogClose>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
