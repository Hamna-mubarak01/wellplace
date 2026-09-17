import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  entriesForSuite,
  hourMarks,
  placeEntry,
  type BoardEntry,
  type BoardWindow,
} from "@/components/console/reception/board-types";
import { parseRange } from "@/lib/db/queries/board";

const WINDOW: BoardWindow = {
  start: "2026-09-14T06:00:00.000Z",
  end: "2026-09-14T18:00:00.000Z",
};

const entry = (over: Partial<BoardEntry> = {}): BoardEntry => ({
  id: "e1",
  suiteId: "s1",
  bookingId: "b1",
  bookingReference: "WP-0001",
  guestName: "A. Guest",
  state: "booked",
  experienceStart: "2026-09-14T09:00:00.000Z",
  experienceEnd: "2026-09-14T12:00:00.000Z",
  blockedEnd: "2026-09-14T12:20:00.000Z",
  holdExpiresAt: null,
  reason: null,
  ...over,
});

describe("§9.1 — the suite timeline places every claim on the right part of the day", () => {
  it("places a three-hour booking a quarter of the way into a twelve-hour window", () => {
    const placement = placeEntry(entry(), WINDOW);

    expect(placement?.leftPercent).toBeCloseTo(25, 6);
    expect(placement?.widthPercent).toBeCloseTo(25, 6);
  });

  it("§7.1 — draws the cleaning buffer as its own trailing segment", () => {
    const placement = placeEntry(entry(), WINDOW);

    expect(placement?.bufferPercent).toBeCloseTo((20 / 720) * 100, 6);
  });

  it("shows no buffer segment when the claim carries none", () => {
    const placement = placeEntry(
      entry({ blockedEnd: "2026-09-14T12:00:00.000Z" }),
      WINDOW,
    );

    expect(placement?.bufferPercent).toBe(0);
  });

  it("clips a claim that starts before the window opens", () => {
    const placement = placeEntry(
      entry({ experienceStart: "2026-09-14T03:00:00.000Z" }),
      WINDOW,
    );

    expect(placement?.leftPercent).toBe(0);
    expect(placement?.widthPercent).toBeCloseTo(50, 6);
  });

  it("clips a claim that runs past closing", () => {
    const placement = placeEntry(
      entry({
        experienceStart: "2026-09-14T16:00:00.000Z",
        experienceEnd: "2026-09-14T21:00:00.000Z",
        blockedEnd: "2026-09-14T21:20:00.000Z",
      }),
      WINDOW,
    );

    expect((placement?.leftPercent ?? 0) + (placement?.widthPercent ?? 0)).toBeCloseTo(
      100,
      6,
    );
    expect(placement?.bufferPercent).toBe(0);
  });

  it("drops a claim that falls entirely outside the window", () => {
    expect(
      placeEntry(
        entry({
          experienceStart: "2026-09-13T09:00:00.000Z",
          experienceEnd: "2026-09-13T12:00:00.000Z",
          blockedEnd: "2026-09-13T12:20:00.000Z",
        }),
        WINDOW,
      ),
    ).toBeNull();
  });

  it("refuses a window that has no duration", () => {
    expect(placeEntry(entry(), { start: WINDOW.start, end: WINDOW.start })).toBeNull();
  });
});

describe("the timeline axis and lanes", () => {
  it("marks every whole hour inside the window", () => {
    expect(hourMarks(WINDOW)).toHaveLength(13);
  });

  it("returns no marks for an inverted window", () => {
    expect(hourMarks({ start: WINDOW.end, end: WINDOW.start })).toHaveLength(0);
  });

  it("keeps each suite's lane to its own claims, in time order", () => {
    const rows = [
      entry({ id: "late", experienceStart: "2026-09-14T14:00:00.000Z" }),
      entry({ id: "early", experienceStart: "2026-09-14T08:00:00.000Z" }),
      entry({ id: "other", suiteId: "s2" }),
    ];

    expect(entriesForSuite(rows, "s1").map((row) => row.id)).toEqual([
      "early",
      "late",
    ]);
  });
});

describe("Postgres range parsing", () => {
  it("reads a half-open tstzrange as returned by PostgREST", () => {
    const parsed = parseRange('["2026-09-14 09:00:00+00","2026-09-14 12:00:00+00")');

    expect(parsed?.start).toBe("2026-09-14T09:00:00.000Z");
    expect(parsed?.end).toBe("2026-09-14T12:00:00.000Z");
  });

  it("reads a range whose offset is already fully qualified", () => {
    const parsed = parseRange('["2026-09-14 13:00:00+04:00","2026-09-14 16:00:00+04:00")');

    expect(parsed?.start).toBe("2026-09-14T09:00:00.000Z");
  });

  it("returns null rather than an invalid date for anything else", () => {
    expect(parseRange("not a range")).toBeNull();
    expect(parseRange("[bad,worse)")).toBeNull();
  });
});

describe("the buffer the board draws is the configured one", () => {
  it("reads 20 minutes from configuration", () => {
    expect(requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes")).toBe(20);
  });
});
