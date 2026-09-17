"use client";

import { useEffect, useRef, useState } from "react";
import { DoorClosedIcon, TriangleAlertIcon } from "lucide-react";

import {
  timelineMarkStep,
  type TimelineZoom,
} from "@/lib/config/reception-display";
import { useTimelineSpan } from "./timeline-zoom";
import { useTimelineViewport } from "./timeline-viewport";

import { cn } from "@/lib/utils";
import { formatDubaiTime } from "@/lib/domain/time";
import {
  axisMarks,
  entriesForSuite,
  offsetPercent,
  overdueCleaningMinutes,
  liveSuiteStatus,
  overdueBufferForSuite,
  placeEntry,
  type BoardData,
  type BoardEntry,
} from "@/components/console/reception/board-types";
import {
  isMovable,
  isUnchanged,
  laneAt,
  previewEntry,
  proposeStart,
  type LaneBound,
  type MoveProposal,
} from "@/components/console/reception/board-drag";
import {
  OccupancyChip,
  chipDescription,
} from "@/components/console/reception/occupancy-chip";
import {
  NEVER_AUTO_ALLOCATED,
  SuiteStatusBadge,
} from "@/components/console/reception/suite-status-badge";
import { ScheduleBufferDialog } from "./schedule-buffer-dialog";
import { ScheduleEntrySheet } from "@/components/console/reception/schedule-entry-sheet";
import { SuiteLaneActions } from "@/components/console/reception/suite-lane-actions";
import { MoveSuiteDialog } from "@/components/console/reception/move-suite-dialog";
import { moveStartRefusal } from "@/lib/domain/booking";
import { Button } from "@/components/shared/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ConsoleEmpty } from "@/components/console/console-surface";

const DRAG_THRESHOLD_PX = 4;
const NOW_TICK_MS = 30_000;

interface DragOrigin {
  readonly entryId: string;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly trackWidth: number;
  readonly originStartMs: number;
  readonly trackLeft: number;
}

interface DragPreview {
  readonly entryId: string;
  readonly suiteId: string;
  readonly startsAt: string;
  readonly moved: boolean;
  readonly offsetY: number;
  readonly valid: boolean;
}

interface MoveRequest {
  readonly entryId: string;
  readonly proposal: MoveProposal;
}

function trackHours(start: string, end: string): number {
  const hours = (Date.parse(end) - Date.parse(start)) / (60 * 60 * 1000);
  if (!Number.isFinite(hours) || hours <= 0) return 1;
  return Math.max(hours, 1);
}

export interface SuiteTimelineProps {
  readOnly?: boolean;
  board: BoardData;
  intervalMinutes: number;
  zoom?: TimelineZoom;
  showNow?: boolean;
  scrollToNow?: boolean;
}

export function SuiteTimeline({
  board,
  intervalMinutes,
  readOnly = false,
  showNow = false,
  scrollToNow = false,
}: SuiteTimelineProps) {
  const { suites, entries } = board;

  const span = useTimelineSpan();
  const view =
    span === "opening" ? (board.openingWindow ?? board.window) : board.window;
  const zoom = String(span);
  const visibleMinutes =
    span === "opening"
      ? (Date.parse(view.end) - Date.parse(view.start)) / 60_000
      : span;
  const { scrollRef, trackRef, viewport } = useTimelineViewport(
    zoom,
    view.start,
    view.end,
    scrollToNow,
    suites.length > 0,
    board.window.start,
  );
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragOrigin | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
  const suppressClickRef = useRef(false);

  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [bufferBookingId, setBufferBookingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [request, setRequest] = useState<MoveRequest | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!showNow) return;

    const tick = () => setNowMs(Date.now());
    const first = globalThis.setTimeout(tick, 0);
    const timer = globalThis.setInterval(tick, NOW_TICK_MS);

    return () => {
      globalThis.clearTimeout(first);
      globalThis.clearInterval(timer);
    };
  }, [showNow]);

  if (suites.length === 0) {
    return (
      <ConsoleEmpty
        Icon={DoorClosedIcon}
        title="No suites are configured yet"
        description="Management configures suites on the Suites page. They appear here once they exist."
      />
    );
  }

  const marks = axisMarks(view, timelineMarkStep(visibleMinutes)).filter(
    (mark) => {
      if (viewport.track <= 0) return span === "opening";
      const x = ((offsetPercent(mark, view) ?? 0) / 100) * viewport.track;
      return (
        x >= viewport.left - 100 && x <= viewport.left + viewport.width + 100
      );
    },
  );
  const hours = trackHours(view.start, view.end);
  const spanMs = Date.parse(view.end) - Date.parse(view.start);
  const ratio = Math.max(1, (hours * 60) / visibleMinutes);
  const trackMeasure = `calc((100% - var(--measure-timeline-label)) * ${ratio} + var(--measure-timeline-label))`;
  const nowPercent =
    !showNow || nowMs === null ? null : offsetPercent(nowMs, view);
  const nowVisible =
    nowPercent !== null && nowPercent >= 0 && nowPercent <= 100;
  const nowLabel = nowMs === null ? "" : formatDubaiTime(new Date(nowMs));

  const requestedEntry =
    request === null
      ? null
      : (entries.find((entry) => entry.id === request.entryId) ?? null);

  const applyPreview = (next: DragPreview | null) => {
    previewRef.current = next;
    setPreview((current) =>
      current?.entryId === next?.entryId &&
      current?.suiteId === next?.suiteId &&
      current?.startsAt === next?.startsAt &&
      current?.moved === next?.moved &&
      current?.offsetY === next?.offsetY &&
      current?.valid === next?.valid
        ? current
        : next,
    );
  };

  const laneBounds = (): LaneBound[] =>
    suites
      .map((suite) => {
        const element = laneRefs.current.get(suite.id);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { suiteId: suite.id, top: rect.top, bottom: rect.bottom };
      })
      .filter((bound): bound is LaneBound => bound !== null)
      .sort((a, b) => a.top - b.top);

  const cancelDrag = () => {
    suppressClickRef.current = previewRef.current?.moved ?? false;
    dragRef.current = null;
    applyPreview(null);
  };

  const beginDrag =
    (entry: BoardEntry) => (event: React.PointerEvent<HTMLElement>) => {
      suppressClickRef.current = false;
      if (readOnly || !isMovable(entry)) return;
      if (event.pointerType !== "mouse" || event.button !== 0) return;

      const lane = laneRefs.current.get(entry.suiteId);
      if (!lane) return;

      const rect = lane.getBoundingClientRect();
      const bounds = laneBounds();
      if (rect.width <= 0 || bounds.length === 0) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        entryId: entry.id,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        trackWidth: rect.width,
        originStartMs: Date.parse(entry.experienceStart),
        trackLeft: rect.left,
      };

      applyPreview({
        entryId: entry.id,
        suiteId: entry.suiteId,
        startsAt: entry.experienceStart,
        moved: false,
        offsetY: 0,
        valid: true,
      });
    };

  const trackDrag =
    (entry: BoardEntry) => (event: React.PointerEvent<HTMLElement>) => {
      const origin = dragRef.current;
      if (origin === null) return;
      if (origin.entryId !== entry.id || origin.pointerId !== event.pointerId)
        return;

      const deltaX = event.clientX - origin.clientX;
      const deltaY = event.clientY - origin.clientY;
      if (
        !previewRef.current?.moved &&
        Math.abs(deltaX) < DRAG_THRESHOLD_PX &&
        Math.abs(deltaY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }

      const rect = laneRefs.current.get(entry.suiteId)?.getBoundingClientRect();
      if (!rect) return;
      const bounds = laneBounds();
      const suiteId = laneAt(bounds, event.clientY);
      const target = bounds.find((lane) => lane.suiteId === suiteId);
      const scroll = scrollRef.current?.getBoundingClientRect();
      const labelRight =
        laneRefs.current
          .get(entry.suiteId)
          ?.previousElementSibling?.getBoundingClientRect().right ?? rect.left;
      const valid =
        target !== undefined &&
        event.clientX >= Math.max(rect.left, labelRight) &&
        event.clientX <= Math.min(rect.right, scroll?.right ?? rect.right);
      const shiftedMs =
        origin.originStartMs +
        ((deltaX + origin.trackLeft - rect.left) / origin.trackWidth) * spanMs;

      const startsAt = proposeStart(entry, view, shiftedMs, intervalMinutes);
      applyPreview({
        entryId: entry.id,
        suiteId: suiteId ?? entry.suiteId,
        startsAt,
        moved: true,
        offsetY: target ? target.top - rect.top : 0,
        valid: valid && moveStartRefusal(entry.experienceStart, startsAt, Date.now()) === null,
      });
    };

  const endDrag =
    (entry: BoardEntry) => (event: React.PointerEvent<HTMLElement>) => {
      const origin = dragRef.current;
      if (
        origin === null ||
        origin.entryId !== entry.id ||
        origin.pointerId !== event.pointerId
      )
        return;
      trackDrag(entry)(event);
      dragRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      const current = previewRef.current;
      if (current === null) return;
      if (current.moved) suppressClickRef.current = true;

      const proposal: MoveProposal = {
        suiteId: current.suiteId,
        startsAt: current.startsAt,
      };

      if (!current.moved || !current.valid || isUnchanged(entry, proposal)) {
        applyPreview(null);
        return;
      }

      setRequest({ entryId: entry.id, proposal });
    };

  const requestMove = (entry: BoardEntry) => {
    applyPreview(null);
    setRequest({
      entryId: entry.id,
      proposal: { suiteId: entry.suiteId, startsAt: entry.experienceStart },
    });
  };

  const closeRequest = () => {
    setRequest(null);
    applyPreview(null);
  };

  const unreleased = suites
    .map((suite) => ({
      suite,
      entry: overdueBufferForSuite(entries, suite, nowMs ?? 0),
    }))
    .filter(
      (row): row is { suite: (typeof suites)[number]; entry: BoardEntry } =>
        row.entry !== undefined,
    );

  return (
    <div className="flex flex-col gap-2">
      {unreleased.length > 0 && (
        <Alert
          role="status"
          variant="destructive"
          className="border-danger-border bg-danger-wash p-3 text-danger-ink"
        >
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>Suites awaiting release</AlertTitle>
          <AlertDescription className="text-danger-ink">
            {unreleased
              .map(
                (row) =>
                  `Suite ${row.suite.suiteNumber} (${overdueCleaningMinutes(row.entry, nowMs ?? 0)} min overdue)`,
              )
              .join(", ")}
            . Extend the striped buffer, or mark the suite Available when ready.
          </AlertDescription>
        </Alert>
      )}
      <div
        ref={scrollRef}
        data-reception-dragging={preview !== null}
        role="region"
        aria-label="Suite timeline; swipe horizontally to see more times"
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain rounded-(--radius-card) border border-border bg-surface-raised focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <div
          style={{
            minWidth:
              span === "opening"
                ? "var(--measure-reception-timeline-min)"
                : trackMeasure,
          }}
        >
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-20 w-timeline-label shrink-0 border-r border-border bg-surface-raised px-3 py-2 text-console-label tracking-label text-text-muted uppercase">
              Suite
            </div>
            <div ref={trackRef} className="relative h-timeline-axis grow">
              {marks.map((mark) => {
                const offset = offsetPercent(mark, view);
                if (offset === null) return null;
                return (
                  <span
                    key={mark}
                    style={{ left: `${offset}%` }}
                    className={cn(
                      "absolute top-2 font-data text-micro tabular-nums text-text-muted",
                      offset === 0
                        ? "translate-x-1"
                        : offset === 100
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                    )}
                  >
                    {formatDubaiTime(mark)}
                  </span>
                );
              })}

              {nowVisible && (
                <span
                  style={{ left: `${nowPercent}%` }}
                  className="absolute top-1 z-10 -translate-x-1/2 rounded-(--radius-inner) bg-brand px-1 font-data text-micro tabular-nums text-on-brand"
                >
                  Now {nowLabel}
                </span>
              )}
            </div>
          </div>

          {suites.map((suite) => {
            const lane = entriesForSuite(entries, suite.id);
            const unavailable = NEVER_AUTO_ALLOCATED.includes(suite.status);
            const overdue = overdueBufferForSuite(lane, suite, nowMs ?? 0);
            const dropTarget =
              preview !== null &&
              preview.moved &&
              preview.valid &&
              preview.suiteId === suite.id;

            return (
              <div
                key={suite.id}
                data-suite-row={suite.id}
                data-cleaning-overdue={Boolean(overdue)}
                className={cn(
                  "flex border-b last:border-b-0",
                  overdue
                    ? "border-danger-border bg-danger-wash"
                    : "border-border",
                )}
              >
                <div
                  className={cn(
                    "sticky left-0 z-20 flex w-timeline-label shrink-0 items-center justify-between gap-1 border-r px-3 py-2",
                    overdue
                      ? "border-danger-border bg-danger-wash"
                      : "border-border",
                    overdue
                      ? undefined
                      : unavailable
                        ? "bg-surface-sunken"
                        : "bg-surface-raised",
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-data text-console-table font-medium tabular-nums text-text-primary">
                      Suite {suite.suiteNumber}
                    </span>
                    <SuiteStatusBadge status={liveSuiteStatus(suite, lane, nowMs)} />
                  </span>

                  {
                    <SuiteLaneActions
                      readOnly={readOnly}
                      onInspect={(entry) => setSelectedId(entry.id)}
                      suite={suite}
                      entries={lane}
                      onRequestMove={requestMove}
                    />
                  }
                </div>

                <div
                  data-suite-lane={suite.id}
                  ref={(element) => {
                    if (element) laneRefs.current.set(suite.id, element);
                    else laneRefs.current.delete(suite.id);
                  }}
                  className={cn(
                    "relative h-timeline-lane grow",
                    overdue
                      ? "bg-danger-wash"
                      : unavailable && "bg-surface-sunken",
                    dropTarget && !overdue && "bg-surface-hover",
                  )}
                >
                  {marks.map((mark) => {
                    const offset = offsetPercent(mark, view);
                    if (offset === null) return null;
                    return (
                      <span
                        key={mark}
                        aria-hidden="true"
                        style={{ left: `${offset}%` }}
                        className="absolute inset-y-0 w-px bg-border"
                      />
                    );
                  })}

                  {nowVisible && (
                    <span
                      aria-hidden="true"
                      style={{
                        left: `${nowPercent}%`,
                        width: "var(--measure-timeline-now)",
                      }}
                      className="absolute inset-y-0 -translate-x-1/2 bg-brand"
                    />
                  )}

                  {lane.map((entry) => {
                    const dragging =
                      preview !== null &&
                      preview.entryId === entry.id &&
                      preview.moved;
                    const shifting = dragging;
                    const shown =
                      shifting && preview !== null
                        ? previewEntry(entry, {
                            suiteId: preview.suiteId,
                            startsAt: preview.startsAt,
                          })
                        : entry;

                    const placement = placeEntry(shown, view);
                    if (placement === null) return null;

                    const movable = !readOnly && isMovable(entry);
                    const total =
                      placement.widthPercent + placement.bufferPercent;
                    const laneShift = shifting ? preview.offsetY : 0;

                    const chip = (
                      <OccupancyChip
                        entry={shown}
                        contentOffset={Math.max(
                          0,
                          Math.min(
                            viewport.left -
                              (placement.leftPercent / 100) * viewport.track,
                            (placement.widthPercent / 100) * viewport.track -
                              48,
                          ),
                        )}
                        className={cn(
                          "h-full w-full",
                          movable && "cursor-grab select-none",
                          dragging &&
                            "cursor-grabbing ring-2 ring-border-hover",
                          dragging && !preview.valid && "opacity-50",
                        )}
                      />
                    );

                    const dragProps = movable
                      ? {
                          onPointerDown: beginDrag(entry),
                          onPointerMove: trackDrag(entry),
                          onPointerUp: endDrag(entry),
                          onPointerCancel: cancelDrag,
                          onLostPointerCapture: () => {
                            if (dragRef.current) cancelDrag();
                          },
                          onKeyDown: (event: React.KeyboardEvent) => {
                            if (event.key === "Escape") cancelDrag();
                          },
                        }
                      : {};

                    return (
                      <div
                        key={entry.id}
                        style={{
                          left: `${placement.leftPercent}%`,
                          width: `${total}%`,
                          transform:
                            laneShift === 0
                              ? undefined
                              : `translateY(${laneShift}px)`,
                        }}
                        data-booking-id={entry.id}
                        className={cn(
                          "reception-drag-entry absolute inset-y-1.5",
                          dragging && "z-30",
                        )}
                      >
                        <div className="relative h-full">
                          <div
                            className="reception-booking-block absolute inset-y-0 left-0"
                            style={{
                              width: `${(placement.widthPercent / total) * 100}%`,
                            }}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label={chipDescription(entry)}
                              className="reception-booking-trigger h-full! w-full touch-auto rounded-(--radius-control) border-0 p-0 focus-visible:ring-2 focus-visible:ring-focus-ring"
                              onClick={() => {
                                if (suppressClickRef.current) {
                                  suppressClickRef.current = false;
                                  return;
                                }
                                setSelectedId(entry.id);
                              }}
                              {...dragProps}
                            >
                              {chip}
                            </Button>
                          </div>

                          {placement.bufferPercent > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label={
                                overdue?.id === entry.id
                                  ? `Cleaning overdue for ${entry.guestName ?? entry.bookingReference ?? "this booking"}. Reserved cleaning ended ${formatDubaiTime(entry.blockedEnd)}, ${overdueCleaningMinutes(entry)} minutes ago, and Suite ${suite.suiteNumber} has not been released.`
                                  : `Cleaning buffer for ${entry.guestName ?? entry.bookingReference ?? "this booking"}, ${formatDubaiTime(entry.experienceEnd)} to ${formatDubaiTime(entry.blockedEnd)}`
                              }
                              onClick={() => {
                                if (!readOnly && entry.bookingId)
                                  setBufferBookingId(entry.bookingId);
                                else setSelectedId(entry.id);
                              }}
                              style={{
                                width: `${(placement.bufferPercent / total) * 100}%`,
                              }}
                              className={cn(
                                "reception-buffer-trigger absolute inset-y-0 right-0 h-full! rounded-l-none rounded-r-(--radius-control) border-y border-r p-0",
                                overdue?.id === entry.id
                                  ? "reception-cleaning-overdue border-danger-border"
                                  : "reception-cleaning-buffer border-border-strong",
                              )}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {lane.length === 0 && (
                    <span className="absolute inset-y-0 left-3 flex items-center text-micro text-text-muted">
                      {unavailable ? "Unavailable" : "No bookings"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {preview?.moved
          ? preview.valid
            ? `Move to Suite ${suites.find((suite) => suite.id === preview.suiteId)?.suiteNumber}, ${formatDubaiTime(preview.startsAt)}. Release to review.`
            : "Outside the schedule. Release to cancel."
          : ""}
      </p>
      <p className="text-micro text-text-muted">
        {readOnly
          ? "Tap a booking or block for details. Swipe to browse the schedule."
          : "Tap a booking for details or its striped buffer to manage cleaning time. Swipe to browse the schedule; use Move booking to change its suite or time."}
      </p>

      {entries
        .filter((entry) => entry.id === selectedId)
        .map((entry) => (
          <ScheduleEntrySheet
            key={entry.id}
            readOnly={readOnly}
            entry={entry}
            suite={suites.find((suite) => suite.id === entry.suiteId)}
            onClose={() => setSelectedId(null)}
            onMove={() => {
              setSelectedId(null);
              requestMove(entry);
            }}
          />
        ))}

      {bufferBookingId && (
        <ScheduleBufferDialog
          key={bufferBookingId}
          bookingId={bufferBookingId}
          onClose={() => setBufferBookingId(null)}
        />
      )}

      {requestedEntry !== null && request !== null && (
        <MoveSuiteDialog
          key={`${request.entryId}-${request.proposal.suiteId}-${request.proposal.startsAt}`}
          entry={requestedEntry}
          suites={suites}
          view={view}
          bookableWindow={board.openingWindow ?? null}
          intervalMinutes={intervalMinutes}
          nowMs={nowMs ?? 0}
          initial={request.proposal}
          onClose={closeRequest}
        />
      )}
    </div>
  );
}
