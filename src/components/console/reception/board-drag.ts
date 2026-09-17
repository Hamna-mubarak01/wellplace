import { moveStartRefusal } from "@/lib/domain/booking";
import type {
  BoardEntry,
  BoardState,
  BoardWindow,
} from "@/components/console/reception/board-types";

export const MOVABLE_STATES: readonly BoardState[] = ["booked", "checked_in"];

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

export interface MoveProposal {
  readonly suiteId: string;
  readonly startsAt: string;
}

export function isMovable(entry: BoardEntry): boolean {
  return entry.bookingId !== null && MOVABLE_STATES.includes(entry.state);
}

export function entryDurationMs(entry: BoardEntry): number {
  const span = Date.parse(entry.experienceEnd) - Date.parse(entry.experienceStart);
  return Number.isFinite(span) && span > 0 ? span : MILLISECONDS_PER_HOUR;
}

export function entryBufferMs(entry: BoardEntry): number {
  const span = Date.parse(entry.blockedEnd) - Date.parse(entry.experienceEnd);
  return Number.isFinite(span) && span > 0 ? span : 0;
}

export function snapToGrid(
  instantMs: number,
  anchorMs: number,
  intervalMinutes: number,
): number {
  const step = Math.max(1, Math.round(intervalMinutes)) * MILLISECONDS_PER_MINUTE;
  return anchorMs + Math.round((instantMs - anchorMs) / step) * step;
}

export function clampStartMs(
  startMs: number,
  durationMs: number,
  window: BoardWindow,
): number {
  const first = Date.parse(window.start);
  const last = Date.parse(window.end) - durationMs;
  if (!Number.isFinite(first)) return startMs;
  if (!Number.isFinite(last) || last <= first) return first;
  return Math.min(Math.max(startMs, first), last);
}

export function proposeStart(
  entry: BoardEntry,
  window: BoardWindow,
  shiftedStartMs: number,
  intervalMinutes: number,
): string {
  const anchor = Date.parse(window.start);
  const snapped = snapToGrid(shiftedStartMs, anchor, intervalMinutes);
  const clamped = clampStartMs(snapped, entryDurationMs(entry), window);
  const step = Math.max(1, Math.round(intervalMinutes)) * MILLISECONDS_PER_MINUTE;
  return new Date(anchor + Math.floor((clamped - anchor) / step) * step).toISOString();
}

export function isUnchanged(entry: BoardEntry, proposal: MoveProposal): boolean {
  return (
    proposal.suiteId === entry.suiteId &&
    Date.parse(proposal.startsAt) === Date.parse(entry.experienceStart)
  );
}

export function movesSuite(entry: BoardEntry, proposal: MoveProposal): boolean {
  return proposal.suiteId !== entry.suiteId;
}

export function proposedEnd(entry: BoardEntry, proposal: MoveProposal): string {
  const startMs = Date.parse(proposal.startsAt);
  return new Date(startMs + entryDurationMs(entry)).toISOString();
}

export function previewEntry(entry: BoardEntry, proposal: MoveProposal): BoardEntry {
  const startMs = Date.parse(proposal.startsAt);
  const durationMs = entryDurationMs(entry);
  const bufferMs = entryBufferMs(entry);

  return {
    ...entry,
    suiteId: proposal.suiteId,
    experienceStart: proposal.startsAt,
    experienceEnd: new Date(startMs + durationMs).toISOString(),
    blockedEnd: new Date(startMs + durationMs + bufferMs).toISOString(),
  };
}

export function gridStarts(
  entry: BoardEntry,
  window: BoardWindow,
  intervalMinutes: number,
  nowMs: number,
): readonly string[] {
  const first = Date.parse(window.start);
  const last = Date.parse(window.end) - entryDurationMs(entry);
  const step = Math.max(1, Math.round(intervalMinutes)) * MILLISECONDS_PER_MINUTE;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return [];

  const slots: string[] = [];
  for (let instant = first; instant <= last; instant += step) {
    const slot = new Date(instant).toISOString();
    if (moveStartRefusal(entry.experienceStart, slot, nowMs) === null) slots.push(slot);
  }

  const current = entry.experienceStart;
  if (!slots.some((slot) => Date.parse(slot) === Date.parse(current))) {
    slots.push(new Date(Date.parse(current)).toISOString());
    slots.sort((a, b) => Date.parse(a) - Date.parse(b));
  }

  return slots;
}

export interface LaneBound {
  readonly suiteId: string;
  readonly top: number;
  readonly bottom: number;
}

export function laneAt(bounds: readonly LaneBound[], clientY: number): string | null {
  if (bounds.length === 0) return null;

  const inside = bounds.find(
    (bound) => clientY >= bound.top && clientY < bound.bottom,
  );
  if (inside) return inside.suiteId;

  return bounds.find((bound, index) => clientY >= bound.bottom && clientY < (bounds[index + 1]?.top ?? bound.bottom))?.suiteId ?? null;
}
