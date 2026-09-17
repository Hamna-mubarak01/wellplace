"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import {
  TODAY_BOOKING_COPY,
  TODAY_BOOKING_REDUCED_TICK_MS,
  TODAY_BOOKING_REFRESH_MS,
  TODAY_BOOKING_TICK_MS,
} from "@/lib/config/today-booking";
import type { TodayBookingStatus } from "@/lib/services/today-booking-service";
import { cn } from "@/lib/utils";

const COPY = TODAY_BOOKING_COPY;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parts(ms: number): { hours: string; minutes: string; seconds: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hours: pad(Math.floor(total / 3600)),
    minutes: pad(Math.floor((total % 3600) / 60)),
    seconds: pad(total % 60),
  };
}

function countdown(ms: number, coarse: boolean): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (coarse) return hours > 0 ? `${hours} ${COPY.hoursShort} ${minutes} ${COPY.minutesShort}` : `${Math.max(1, minutes)} ${COPY.minutesShort}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function isStatus(value: unknown): value is TodayBookingStatus {
  return typeof value === "object" && value !== null && "kind" in value && "serverNow" in value;
}

type TimerTone = "surface" | "band";

function DigitTile({ value, tone }: { value: string; tone: TimerTone }) {
  return (
    <span
      className={cn(
        "grid h-8 min-w-8 place-items-center rounded-(--radius-control) border px-1 font-data text-small leading-none font-semibold tabular-nums @xs:h-9 @xs:min-w-9 @xs:px-1.5 @xs:text-body",
        tone === "band" ? "border-band-line bg-band-ink/5 text-band-ink" : "border-border bg-surface-sunken text-text-primary",
        " transition-colors duration-500 motion-reduce:transition-none @sm:h-11 @sm:min-w-11 @sm:px-2 @sm:text-h3 @md:h-14 @md:min-w-14 @md:text-h2",
      )}
    >
      {value}
    </span>
  );
}

function TileSeparator({ tone }: { tone: TimerTone }) {
  return (
    <span aria-hidden="true" className="flex h-8 flex-col items-center justify-center gap-1 px-0.5 @xs:h-9 @xs:px-1 @sm:h-11 @sm:gap-1.5 @md:h-14 @md:px-1.5">
      <span className={cn("size-1 rounded-full", tone === "band" ? "bg-band-line" : "bg-border-strong")} />
      <span className={cn("size-1 rounded-full", tone === "band" ? "bg-band-line" : "bg-border-strong")} />
    </span>
  );
}

function LiveDot({ open, tone }: { open: boolean; tone: TimerTone }) {
  const color = tone === "band" ? "bg-band-accent" : "bg-brand";
  return (
    <span aria-hidden="true" className="relative flex size-2 shrink-0">
      {open ? <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", color)} /> : null}
      <span className={cn("relative inline-flex size-2 rounded-full", open ? color : "bg-danger")} />
    </span>
  );
}

export interface TodayBookingCountdownProps {
  status: TodayBookingStatus;
  bookHref: string;
  refresh?: boolean;
  tone?: TimerTone;
  className?: string;
}

export function TodayBookingCountdown({ status: initial, bookHref, refresh = false, tone = "surface", className }: TodayBookingCountdownProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [status, setStatus] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  const offset = useRef(0);

  useEffect(() => {
    offset.current = Date.parse(status.serverNow) - Date.now();
    const tick = () => setNow(Date.now() + offset.current);
    tick();
    const timer = window.setInterval(tick, reducedMotion ? TODAY_BOOKING_REDUCED_TICK_MS : TODAY_BOOKING_TICK_MS);
    return () => window.clearInterval(timer);
  }, [status.serverNow, reducedMotion]);

  useEffect(() => {
    if (!refresh) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/availability/today", { cache: "no-store" });
        const body: unknown = await response.json();
        if (active && isStatus(body)) setStatus(body);
      } catch {}
    };
    const timer = window.setInterval(load, TODAY_BOOKING_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const closesAt = status.kind === "open" ? Date.parse(status.closesAt) : null;
  const remaining = closesAt === null ? 0 : closesAt - now;
  const kind = status.kind === "open" && remaining <= 0 ? "closed" : status.kind;
  if (kind === "closed") return null;

  const open = kind === "open";
  const digits = parts(remaining);
  const tag = status.kind !== "closed" ? status.tag : null;
  const band = tone === "band";

  return (
    <div
      role="status"
      className={cn(
        "@container relative isolate mx-auto w-full max-w-card-panel overflow-hidden text-left transition-colors duration-500 motion-reduce:transition-none",
        band
          ? "rounded-full border border-band-line bg-band-deep/55 px-5 py-2.5 text-band-ink shadow-(--shadow-md) backdrop-blur-md sm:px-6 sm:py-3"
          : "today-timer-grain rounded-(--radius-modal) border border-border border-t-brand/40 bg-surface-raised px-4 py-3 text-text-primary shadow-(--shadow-lg) sm:px-6 sm:py-4",
        className,
      )}
    >
      <div className="relative flex items-center justify-between gap-3 @md:gap-6">
        <div className="flex min-w-0 flex-col items-start gap-1.5 @md:gap-2">
          <p
            className={cn(
              "flex items-center gap-2 font-data text-fine font-medium tracking-normal text-balance uppercase @sm:tracking-label @md:gap-3 @md:text-body @md:font-semibold @md:tracking-label",
              band ? "text-band-accent" : "text-brand",
            )}
          >
            <LiveDot open={open} tone={tone} />
            {open ? COPY.closingIn : COPY.fullyBooked}
          </p>
          {tag ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-data text-fine font-semibold tracking-label uppercase @md:px-2.5 @md:text-micro",
                band ? "bg-band-accent text-band-deep" : "bg-brand text-on-brand",
              )}
            >
              {tag}
            </span>
          ) : null}
        </div>

        {open ? (
          <div className="flex shrink-0 items-center">
            <span className="sr-only">{countdown(remaining, true)}</span>
            <div aria-hidden="true" className="flex items-center">
              <DigitTile value={digits.hours} tone={tone} />
              <TileSeparator tone={tone} />
              <DigitTile value={digits.minutes} tone={tone} />
              {reducedMotion ? null : (
                <>
                  <TileSeparator tone={tone} />
                  <DigitTile value={digits.seconds} tone={tone} />
                </>
              )}
            </div>
          </div>
        ) : (
          <Link
            href={bookHref}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-control) text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
              band ? "text-band-accent hover:text-band-ink focus-visible:outline-band-accent" : "text-brand hover:text-brand-hover focus-visible:outline-brand",
            )}
          >
            {COPY.otherDays}
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
