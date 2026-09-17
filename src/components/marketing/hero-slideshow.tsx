"use client";

import { MediaFrame } from "@/components/shared/media-frame";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";


export interface HeroSlide {
  readonly src: string;
  readonly focus: string;
  readonly kind?: "image" | "video";
  readonly poster?: string;
}

const DWELL_MS = 6000;
const FADE_MS = 1800;

const DRIFT_MS = DWELL_MS + FADE_MS;

const SLIDES: readonly HeroSlide[] = [
  { src: "/renderings/reception-sitting-areaa-view-1-1920.webp", focus: "52% 42%" },
  { src: "/renderings/reception-sitting-areaa-view-4-1920.webp", focus: "50% 50%" },
  { src: "/renderings/staircase-corridor-upstair-01-1920.webp", focus: "50% 45%" },
  { src: "/renderings/reception-sitting-areaa-view-8-1920.webp", focus: "50% 40%" },
  { src: "/renderings/reception-sitting-areaa-view-5-1920.webp", focus: "50% 45%" },
  { src: "/renderings/staircase-corridor-upstair-03-1920.webp", focus: "50% 50%" },
];

type SlideState = "idle" | "active" | "leaving";

export interface HeroSlideshowProps {
  label: string;
  className?: string;
  slides?: readonly HeroSlide[];
  sizes?: string;
}

export function HeroSlideshow(props: HeroSlideshowProps) {
  return <HeroSlideshowContent key={JSON.stringify(props.slides ?? SLIDES)} {...props} />;
}

function HeroSlideshowContent({
  label,
  className,
  slides = SLIDES,
  sizes = "(min-width: 1024px) 50vw, 100vw",
}: HeroSlideshowProps) {
  const [{ index, previous }, setSlide] = useState<{
    index: number;
    previous: number | null;
  }>({ index: 0, previous: null });
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setAnimate(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!animate || slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setSlide((current) => ({
        index: (current.index + 1) % slides.length,
        previous: current.index,
      }));
    }, DWELL_MS);
    return () => window.clearInterval(timer);
  }, [animate, slides.length]);

  const mounted = useMemo(() => {
    const next = (index + 1) % slides.length;
    return new Set([0, index, next, previous ?? 0]);
  }, [index, previous, slides.length]);

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative size-full overflow-hidden bg-surface-sunken", className)}
    >
      {slides.map((slide, position) => {
        if (!mounted.has(position)) return null;

        const state: SlideState =
          position === index
            ? "active"
            : position === previous
              ? "leaving"
              : "idle";

        const drifting = animate && state !== "idle";

        return (
          <span
            key={`${slide.kind ?? "image"}:${slide.src}`}
            className="absolute inset-0 will-change-[opacity,transform]"
            style={{
              transformOrigin: slide.focus,
              opacity: state === "active" ? 1 : 0,
              animation: drifting ? `wp-hero-drift ${DRIFT_MS}ms linear both` : undefined,
              transition: animate ? `opacity ${FADE_MS}ms ease-in-out` : undefined,
            }}
          >
            <MediaFrame
              src={slide.kind === "video" ? slide.poster ?? SLIDES[0].src : slide.src}
              alt=""
              sizes={sizes}
              preload={position === 0}
              frameClassName="absolute inset-0 size-full"
              imageStyle={{ objectPosition: slide.focus }}
            />
            {slide.kind === "video" && state === "active" && animate && (
              <HeroVideo src={slide.src} focus={slide.focus} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function HeroVideo({ src, focus }: { src: string; focus: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    const sync = () => {
      if (document.hidden) video?.pause();
      else void video?.play().catch(() => {});
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  if (failed) return null;
  return <video ref={ref} src={src} muted loop playsInline aria-hidden="true" onLoadedData={() => setReady(true)} onError={() => setFailed(true)} className={cn("absolute inset-0 size-full object-cover", !ready && "opacity-0")} style={{ objectPosition: focus }} />;
}
