import { describe, expect, it } from "vitest";

import {
  clampStartMs,
  gridStarts,
  isMovable,
  laneAt,
  previewEntry,
  proposeStart,
  snapToGrid,
  proposedEnd,
} from "@/components/console/reception/board-drag";
import type { BoardEntry, BoardWindow } from "@/components/console/reception/board-types";

const view: BoardWindow = {
  start: "2026-09-07T05:00:00.000Z",
  end: "2026-09-07T18:00:00.000Z",
};

const entry: BoardEntry = {
  id: "e1",
  suiteId: "s1",
  bookingId: "b1",
  bookingReference: "WP-1",
  guestName: "Amal",
  state: "booked",
  experienceStart: "2026-09-07T10:00:00.000Z",
  experienceEnd: "2026-09-07T12:00:00.000Z",
  blockedEnd: "2026-09-07T12:20:00.000Z",
  holdExpiresAt: null,
  reason: null,
};

describe("board drag", () => {
  it("snaps to the configured grid anchored on the window start", () => {
    const anchor = Date.parse(view.start);
    const snapped = snapToGrid(Date.parse("2026-09-07T10:07:00.000Z"), anchor, 15);
    expect(new Date(snapped).toISOString()).toBe("2026-09-07T10:00:00.000Z");

    const up = snapToGrid(Date.parse("2026-09-07T10:08:00.000Z"), anchor, 15);
    expect(new Date(up).toISOString()).toBe("2026-09-07T10:15:00.000Z");
  });

  it("clamps a proposal inside the day", () => {
    expect(proposeStart(entry, view, Date.parse("2026-09-07T04:00:00.000Z"), 15)).toBe(
      "2026-09-07T05:00:00.000Z",
    );
    expect(proposeStart(entry, view, Date.parse("2026-09-07T23:00:00.000Z"), 15)).toBe(
      "2026-09-07T16:00:00.000Z",
    );
  });

  it("[CLIENT] keeps the last start on the grid after an extension changes the duration", () => {
    const extended = { ...entry, experienceEnd: "2026-09-07T12:05:00.000Z" };
    expect(proposeStart(extended, view, Date.parse(view.end), 15)).toBe("2026-09-07T15:45:00.000Z");
  });

  it("keeps duration and buffer in the preview", () => {
    const shifted = previewEntry(entry, {
      suiteId: "s2",
      startsAt: "2026-09-07T11:30:00.000Z",
    });
    expect(shifted.experienceEnd).toBe("2026-09-07T13:30:00.000Z");
    expect(shifted.blockedEnd).toBe("2026-09-07T13:50:00.000Z");
    expect(shifted.suiteId).toBe("s2");
  });

  it("only moves booked and checked-in claims", () => {
    expect(isMovable(entry)).toBe(true);
    expect(isMovable({ ...entry, state: "hold" })).toBe(false);
    expect(isMovable({ ...entry, state: "block", bookingId: null })).toBe(false);
    expect(isMovable({ ...entry, state: "completed" })).toBe(false);
  });

  it("keeps a booking's exact length when it is moved", () => {
    const sameSuite = { suiteId: "s1", startsAt: "2026-09-07T14:00:00.000Z" };
    expect(proposedEnd(entry, sameSuite)).toBe("2026-09-07T16:00:00.000Z");

    const extended = { ...entry, experienceEnd: "2026-09-07T12:30:00.000Z" };
    expect(proposedEnd(extended, sameSuite)).toBe("2026-09-07T16:30:00.000Z");

    const otherSuite = { suiteId: "s2", startsAt: "2026-09-07T14:00:00.000Z" };
    expect(proposedEnd(extended, otherSuite)).toBe("2026-09-07T16:30:00.000Z");
  });

  it("lists grid starts that still fit the day, never earlier than the booking or in the past", () => {
    const slots = gridStarts(entry, view, 15, 0);
    expect(slots[0]).toBe("2026-09-07T10:00:00.000Z");
    expect(slots.at(-1)).toBe("2026-09-07T16:00:00.000Z");
    expect(slots).toContain("2026-09-07T10:00:00.000Z");
    expect(gridStarts(entry, view, 15, Date.parse("2026-09-07T12:05:00.000Z"))).toEqual([
      "2026-09-07T10:00:00.000Z",
      ...slots.filter((slot) => Date.parse(slot) >= Date.parse("2026-09-07T12:15:00.000Z")),
    ]);
  });

  it("[CLIENT] targets the visible row and cancels drops outside the schedule", () => {
    const bounds = [
      { suiteId: "s1", top: 100, bottom: 156 },
      { suiteId: "s2", top: 156, bottom: 212 },
    ];
    expect(laneAt(bounds, 120)).toBe("s1");
    expect(laneAt(bounds, 160)).toBe("s2");
    expect(laneAt(bounds, 10)).toBeNull();
    expect(laneAt(bounds, 900)).toBeNull();
    expect(laneAt([{ suiteId: "s1", top: 100, bottom: 180 }, { suiteId: "s2", top: 181, bottom: 300 }], 240)).toBe("s2");
    expect(laneAt([{ suiteId: "s1", top: 100, bottom: 180 }, { suiteId: "s2", top: 181, bottom: 300 }], 180.5)).toBe("s1");
    expect(laneAt([], 10)).toBeNull();
  });

  it("never lets the clamp invert an impossible window", () => {
    expect(clampStartMs(0, 10, { start: view.end, end: view.start })).toBe(
      Date.parse(view.end),
    );
  });
});
