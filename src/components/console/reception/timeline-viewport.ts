"use client";

import type { BoardWindow } from "./board-types";
import { useLayoutEffect, useRef, useState } from "react";

export interface TimelineViewport {
  left: number;
  width: number;
  track: number;
}

export function centredScroll(previous: TimelineViewport, next: TimelineViewport): number {
  if (previous.track <= 0) return 0;
  const fraction = (previous.left + previous.width / 2) / previous.track;
  return Math.max(0, Math.min(next.track - next.width, fraction * next.track - next.width / 2));
}

export function centredTimeScroll(previous: TimelineViewport, next: TimelineViewport, before: BoardWindow, after: BoardWindow): number {
  if (previous.track <= 0) return 0;
  const instant = Date.parse(before.start) + (previous.left + previous.width / 2) / previous.track * (Date.parse(before.end) - Date.parse(before.start));
  const fraction = (instant - Date.parse(after.start)) / (Date.parse(after.end) - Date.parse(after.start));
  return Math.max(0, Math.min(next.track - next.width, fraction * next.track - next.width / 2));
}

export function useTimelineViewport(zoom: string, start: string, end: string, scrollToNow: boolean, hasSuites: boolean, dateKey = start) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const previous = useRef<TimelineViewport | null>(null);
  const previousDate = useRef("");
  const previousWindow = useRef<BoardWindow>({ start, end });
  const [viewport, setViewport] = useState<TimelineViewport>({ left: 0, width: 0, track: 0 });

  useLayoutEffect(() => {
    const box = scrollRef.current;
    const track = trackRef.current;
    if (!box || !track) return;
    let frame = 0;
    const measure = (): TimelineViewport => ({
      left: box.scrollLeft,
      width: box.clientWidth - (box.scrollWidth - track.clientWidth),
      track: track.clientWidth,
    });
    const read = () => {
      const next = measure();
      previous.current = next;
      setViewport(next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); };
    const next = measure();
    if (previousDate.current !== dateKey) {
      const fraction = (Date.now() - Date.parse(start)) / (Date.parse(end) - Date.parse(start));
      box.scrollLeft = scrollToNow && fraction >= 0 && fraction <= 1
        ? Math.max(0, fraction * next.track - next.width / 2) : 0;
    } else if (previous.current) {
      box.scrollLeft = centredTimeScroll(previous.current, next, previousWindow.current, { start, end });
    }
    previousDate.current = dateKey;
    previousWindow.current = { start, end };
    previous.current = measure();
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(track);
    box.addEventListener("scroll", schedule, { passive: true });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); box.removeEventListener("scroll", schedule); };
  }, [zoom, start, end, scrollToNow, hasSuites, dateKey]);

  return { scrollRef, trackRef, viewport };
}
