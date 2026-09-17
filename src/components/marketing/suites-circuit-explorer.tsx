"use client";

import { FlameIcon, SnowflakeIcon, SofaIcon, WavesIcon, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/shared/button";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import {
  SUITE_CIRCUIT_CONTENT,
  SUITE_CIRCUIT_STEP_MS,
  type SuiteCircuitStation,
} from "@/lib/config/suites";
import { cn } from "@/lib/utils";

const CONTENT = SUITE_CIRCUIT_CONTENT;
const STATIONS = CONTENT.stations;
const COUNT = STATIONS.length;
const RING_RADIUS = 40;
const RING_GAP_DEGREES = 17;

const STATION_ICONS: Readonly<Record<SuiteCircuitStation, LucideIcon>> = {
  heat: FlameIcon,
  cold: SnowflakeIcon,
  water: WavesIcon,
  rest: SofaIcon,
};

const NODE_POSITIONS = [
  "top-1/10 left-1/2",
  "top-1/2 left-9/10",
  "top-9/10 left-1/2",
  "top-1/2 left-1/10",
] as const;

function ringPoint(degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: 50 + RING_RADIUS * Math.cos(radians), y: 50 + RING_RADIUS * Math.sin(radians) };
}

function ringArc(index: number): string {
  const step = 360 / COUNT;
  const start = ringPoint(-90 + index * step + RING_GAP_DEGREES);
  const end = ringPoint(-90 + (index + 1) * step - RING_GAP_DEGREES);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function CircuitRing({ turn, onSelect }: { turn: number; onSelect: (index: number) => void }) {
  const active = turn % COUNT;
  const station = STATIONS[active];
  const Icon = STATION_ICONS[station.key];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-(--measure-suite-circuit)">
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible text-brand">
        <defs>
          <marker id="suite-circuit-arrow" viewBox="0 0 6 6" refX="4.5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
          </marker>
        </defs>
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
        {STATIONS.map((item, index) => {
          const leadsToActive = (index + 1) % COUNT === active;
          return (
            <path
              key={item.key}
              d={ringArc(index)}
              fill="none"
              stroke="currentColor"
              strokeOpacity={leadsToActive ? 0.95 : 0.3}
              strokeWidth={leadsToActive ? 0.9 : 0.6}
              strokeLinecap="round"
              markerEnd="url(#suite-circuit-arrow)"
              className="transition-[stroke-opacity,stroke-width] duration-500 motion-reduce:transition-none"
            />
          );
        })}
        <g className="suite-circuit-orbit" style={{ "--circuit-angle": `${turn * (360 / COUNT)}deg` } as CSSProperties}>
          <circle cx="50" cy={50 - RING_RADIUS} r="1.8" fill="currentColor" />
        </g>
      </svg>

      <div
        key={station.key}
        className="absolute inset-1/4 flex animate-in flex-col items-center justify-center text-center duration-500 fade-in-0 zoom-in-95 motion-reduce:animate-none"
      >
        <Icon aria-hidden="true" className="size-6 text-brand sm:size-7" />
        <p className="mt-2 font-data text-micro font-medium tracking-kicker text-text-muted uppercase">{station.label}</p>
        <p className="mt-1 font-display text-lead leading-tight text-text-primary text-balance sm:text-h3">{station.name}</p>
      </div>

      {STATIONS.map((item, index) => {
        const NodeIcon = STATION_ICONS[item.key];
        const current = index === active;
        return (
          <div
            key={item.key}
            className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5", NODE_POSITIONS[index])}
          >
            <Button
              type="button"
              variant={current ? "default" : "outline"}
              size="icon"
              aria-label={`${CONTENT.showStage} ${item.label}: ${item.name}`}
              aria-pressed={current}
              onClick={() => onSelect(index)}
              className="size-(--measure-suite-circuit-node) rounded-full shadow-(--shadow-md)"
            >
              <NodeIcon aria-hidden="true" className="size-5 sm:size-6" />
            </Button>
            <span
              className={cn(
                "rounded-full bg-surface-base px-2 font-data text-micro font-medium tracking-label uppercase transition-colors duration-300 motion-reduce:transition-none",
                current ? "text-brand" : "text-text-secondary",
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SuitesCircuitExplorer({ intro, hoursRange }: { intro: ReactNode; hoursRange: string | null }) {
  const [turn, setTurn] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const regionRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const active = turn % COUNT;
  const station = STATIONS[active];
  const next = STATIONS[(active + 1) % COUNT];
  const NextIcon = STATION_ICONS[next.key];
  const playing = !reducedMotion && !hovered && !focused && inView && pageVisible;

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

  const select = (index: number) => setTurn((current) => current + ((index - (current % COUNT) + COUNT) % COUNT));
  const advance = () => setTurn((current) => current + 1);

  return (
    <div
      ref={regionRef}
      role="group"
      aria-label={CONTENT.ringLabel}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      style={{ "--suite-circuit-step": `${SUITE_CIRCUIT_STEP_MS}ms` } as CSSProperties}
      className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16"
    >
      <div className="min-w-0">
        {intro}

        <div className="mt-8 grid grid-cols-4 gap-2 sm:mt-10">
          {STATIONS.map((item, index) => {
            const done = index < active;
            const current = index === active;
            return (
              <Button
                key={item.key}
                type="button"
                variant="ghost"
                onClick={() => select(index)}
                aria-label={`${CONTENT.showStage} ${item.label}: ${item.name}`}
                aria-current={current ? "step" : undefined}
                className="group h-auto min-h-tap flex-col items-stretch justify-start gap-2 px-1.5 py-2 text-left"
              >
                <span className="relative block h-1 overflow-hidden rounded-full bg-border">
                  {current ? (
                    <span
                      key={turn}
                      data-paused={playing ? undefined : true}
                      onAnimationEnd={advance}
                      className="suite-circuit-progress absolute inset-0 rounded-full bg-brand"
                    />
                  ) : (
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full bg-brand transition-opacity duration-300 motion-reduce:transition-none",
                        done ? "opacity-60" : "opacity-0",
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "font-data text-micro font-medium tracking-label uppercase transition-colors duration-300 motion-reduce:transition-none",
                    current ? "text-brand" : "text-text-muted group-hover:text-text-secondary",
                  )}
                >
                  {item.label}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised shadow-(--shadow-md) transition-colors duration-500 motion-reduce:transition-none">
          <div
            key={station.key}
            aria-live={playing ? "off" : "polite"}
            className="animate-in p-5 duration-500 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none sm:p-6"
          >
            <p className="font-data text-micro font-medium tracking-kicker text-brand uppercase">
              {CONTENT.nowLabel} · {station.label}
            </p>
            <h3 className="mt-2 font-display text-h3 leading-tight text-text-primary">{station.name}</h3>
            <p className="mt-2 text-small leading-relaxed text-text-secondary text-pretty sm:text-body">{station.body}</p>
            <p className="mt-3 border-l-2 border-brand pl-3 text-small leading-relaxed text-text-primary text-pretty">
              {station.tip}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-sunken px-5 py-3 sm:px-6">
            <p className="flex min-w-0 items-center gap-2 text-small text-text-secondary">
              <span className="font-data text-micro tracking-label text-text-muted uppercase">{CONTENT.nextLabel}</span>
              <NextIcon aria-hidden="true" className="size-4 shrink-0 text-brand" />
              <span className="truncate font-medium text-text-primary">{next.name}</span>
            </p>
            <p className="hidden shrink-0 font-accent text-small text-brand italic sm:block">{CONTENT.roundLabel}</p>
          </div>
        </div>

        {hoursRange ? (
          <p className="mt-4 font-data text-micro tracking-label text-text-muted uppercase">{hoursRange}</p>
        ) : null}
      </div>

      <CircuitRing turn={turn} onSelect={select} />
    </div>
  );
}
