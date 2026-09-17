import { describe, expect, it } from "vitest";

import { stateFor } from "@/lib/services/board-service";
import type { BoardState, OccupancyRow } from "@/lib/db/queries/board";
import { BOARD_STATES } from "@/components/console/reception/board-types";

const row = (boardState: BoardState): OccupancyRow => ({
  id: "o1",
  suiteId: "s1",
  kind: "booking",
  status: "active",
  experienceStart: "2026-09-14T06:00:00.000Z",
  experienceEnd: "2026-09-14T09:00:00.000Z",
  blockedEnd: "2026-09-14T09:20:00.000Z",
  cleaningBufferMinutes: 20,
  expiresAt: null,
  reason: null,
  bookingId: "b1",
  bookingReference: "WP-000001",
  bookingStatus: "confirmed",
  guestName: "A. Guest",
  boardState,
});

describe("§9.1 — the board shows holds, bookings, check-in, cleaning, blocks, maintenance, no-show and completion", () => {
  it("names all eight states", () => {
    expect(BOARD_STATES).toHaveLength(8);
  });

  it("carries every state the view can return through to the console unchanged", () => {
    for (const state of BOARD_STATES) {
      expect(stateFor(row(state))).toBe(state);
    }
  });

  it("never invents a state the console cannot render", () => {
    for (const state of BOARD_STATES) {
      expect(BOARD_STATES).toContain(stateFor(row(state)));
    }
  });

  it("keeps the TypeScript union and the console's list in step", () => {
    const fromUnion: BoardState[] = [
      "hold",
      "booked",
      "checked_in",
      "cleaning",
      "block",
      "maintenance",
      "no_show",
      "completed",
    ];

    expect(fromUnion.toSorted()).toEqual([...BOARD_STATES].toSorted());
  });
});
