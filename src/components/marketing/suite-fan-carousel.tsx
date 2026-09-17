"use client";

import {
  BathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ConciergeBellIcon,
  FlameIcon,
  ShowerHeadIcon,
  SlidersHorizontalIcon,
  SnowflakeIcon,
  SofaIcon,
  SparklesIcon,
  WavesIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import type { ResolvedSuiteCard } from "@/lib/config/cms/suites-content";
import { MARKETING_GALLERY_SWIPE_PX, galleryOffset } from "@/lib/config/marketing";
import {
  SUITE_FAN_AUTOPLAY_MS,
  SUITE_FAN_LABELS,
  suiteCardIcon,
  type SuiteCardIcon,
} from "@/lib/config/suites";
import { cn } from "@/lib/utils";

const ICONS: Readonly<Record<SuiteCardIcon, LucideIcon>> = {
  flame: FlameIcon,
  snowflake: SnowflakeIcon,
  waves: WavesIcon,
  shower: ShowerHeadIcon,
  bath: BathIcon,
  service: ConciergeBellIcon,
  lounge: SofaIcon,
  controls: SlidersHorizontalIcon,
  sparkles: SparklesIcon,
};

const FAN_SPREAD = [0, 1, 1.85, 2.55, 3.1] as const;
const FAN_DROP = [0, 0.8, 2.2, 4, 6] as const;
const FAN_SIDE_SCALE = 0.86;
const FAN_SCALE_STEP = 0.04;

function fanStyle(offset: number, count: number): CSSProperties {
  const depth = Math.min(Math.abs(offset), FAN_SPREAD.length - 1);
  const direction = Math.sign(offset);
  return {
    "--fan-x": direction * FAN_SPREAD[depth],
    "--fan-y": FAN_DROP[depth],
    "--fan-rotate": direction * depth,
    "--fan-depth": depth,
    "--fan-scale": depth === 0 ? "var(--scale-suite-fan-center)" : FAN_SIDE_SCALE - (depth - 1) * FAN_SCALE_STEP,
    zIndex: count - Math.abs(offset),
  } as CSSProperties;
}

function SuiteFanCard({
  card,
  centered,
  onSelect,
}: {
  card: ResolvedSuiteCard;
  centered: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[suiteCardIcon(card.eyebrow)];
  const name = `${card.title} ${card.accent}`.trim();

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-(--radius-modal) border border-border bg-surface-raised shadow-(--shadow-lg) transition-colors duration-500 motion-reduce:transition-none">
      <div className="relative min-h-(--measure-suite-fan-media-min) flex-1 overflow-hidden bg-surface-sunken">
        {centered ? (
          <MediaFrame
            src={card.image}
            alt={card.imageAlt}
            sizes="(max-width: 640px) 80vw, 26rem"
            draggable={false}
            frameClassName="absolute inset-0"
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            tone="scrim"
            size="icon"
            aria-label={`${SUITE_FAN_LABELS.show} ${name}`}
            onClick={onSelect}
            className="suite-fan-media absolute inset-0 size-full p-0"
          >
            <MediaFrame
              src={card.image}
              alt={card.imageAlt}
              sizes="(max-width: 640px) 80vw, 26rem"
              draggable={false}
              frameClassName="absolute inset-0 size-full"
            />
          </Button>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-scrim-ink/85 via-scrim-ink/20 to-transparent"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <h3 className="font-display text-lead leading-tight font-medium text-on-scrim text-balance sm:text-h3">
            {card.title}
          </h3>
          <p className="font-accent text-body font-medium text-band-accent italic sm:text-lead">
            {card.accent}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col px-4 pt-3.5 pb-4 sm:px-5 sm:pt-4 sm:pb-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-body font-semibold text-text-primary">{card.eyebrow}</p>
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-(--radius-card) border border-border bg-surface-sunken text-brand"
          >
            <Icon className="size-4" />
          </span>
        </div>
        <p
          className={cn(
            "mt-1.5 text-small leading-snug text-text-secondary text-pretty",
            centered ? "line-clamp-5" : "line-clamp-3",
          )}
        >
          {card.body}
        </p>

        {card.facilities.length > 0 ? (
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3">
            {card.facilities.map((facility, index) => (
              <li
                key={`${index}-${facility}`}
                className="flex items-start gap-2 text-small leading-snug font-medium text-text-primary"
              >
                <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                {facility}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function SuiteFanCarousel({ cards }: { cards: readonly ResolvedSuiteCard[] }) {
  const [position, setPosition] = useState({ active: 0, previous: 0 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const regionRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const count = cards.length;
  const { active, previous } = position;
  const playing = count > 1 && !reducedMotion && !hovered && !focused && !touching && inView && pageVisible;

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(region);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setPosition((current) => ({ previous: current.active, active: (current.active + 1) % count }));
    }, SUITE_FAN_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, count, playing]);

  if (count === 0) return null;

  const select = (index: number) =>
    setPosition((current) => ({ previous: current.active, active: ((index % count) + count) % count }));
  const move = (direction: -1 | 1) => select(active + direction);
  const current = cards[active];

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={SUITE_FAN_LABELS.region}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
      }}
    >
      <div
        className="suite-fan-stage touch-pan-y select-none"
        onTouchStart={(event) => {
          setTouching(true);
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          setTouching(false);
          if (!touchStart.current) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - touchStart.current.x;
          const dy = touch.clientY - touchStart.current.y;
          touchStart.current = null;
          if (Math.abs(dx) >= MARKETING_GALLERY_SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
            move(dx < 0 ? 1 : -1);
          }
        }}
        onTouchCancel={() => {
          touchStart.current = null;
          setTouching(false);
        }}
      >
        {cards.map((card, index) => {
          const offset = galleryOffset(index, active, count);
          const jumped = Math.abs(offset - galleryOffset(index, previous, count)) > 1;
          const centered = offset === 0;
          return (
            <div
              key={`${index}-${card.eyebrow}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${card.title} ${card.accent}`.trim()}
              data-center={centered || undefined}
              data-jump={jumped || undefined}
              style={fanStyle(offset, count)}
              onClick={centered ? undefined : () => select(index)}
              className="suite-fan-card"
            >
              <SuiteFanCard card={card} centered={centered} onSelect={() => select(index)} />
            </div>
          );
        })}
      </div>

      <p aria-live={playing ? "off" : "polite"} className="sr-only">
        {current ? `${current.title} ${current.accent}`.trim() : ""}
      </p>

      <div className="mt-3 flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={SUITE_FAN_LABELS.previous}
          onClick={() => move(-1)}
          className="rounded-full"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <div className="hidden items-center sm:flex">
          {cards.map((card, index) => (
            <Button
              key={`${index}-${card.eyebrow}-dot`}
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`${SUITE_FAN_LABELS.show} ${card.title} ${card.accent}`.trim()}
              aria-current={index === active || undefined}
              onClick={() => select(index)}
              className="-mx-1.5 rounded-full"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block size-2 rounded-full transition-[background-color,scale] duration-300 motion-reduce:transition-none",
                  index === active ? "scale-125 bg-brand" : "bg-border-strong",
                )}
              />
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={SUITE_FAN_LABELS.next}
          onClick={() => move(1)}
          className="rounded-full"
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
