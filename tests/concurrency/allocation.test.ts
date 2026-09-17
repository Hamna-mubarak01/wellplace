import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  activeOccupancy,
  harnessIsUp,
  overlappingPairs,
  raceForSlot,
  resetSuites,
  claimDatabase,
  releaseDatabase,
} from "./support/harness";


const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const HOLD = requireSetting(EMPTY_SNAPSHOT, "hold.minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const SLOT = new Date("2026-12-01T06:00:00.000Z");

let up = false;

beforeAll(async () => {
  up = await harnessIsUp();
  if (up) await claimDatabase();
  if (!up) {
    console.warn(
      "\n  ⚠ tests/concurrency skipped — no local Postgres.\n" +
        "    §7.5 requires reproducible evidence; this suite proves nothing until you run:\n" +
        "      npm run db:test:up && npm run db:migrate\n",
    );
  }
});

beforeEach(async () => {
  if (up) await resetSuites();
});

afterAll(async () => {
  if (up) await resetSuites();
  await releaseDatabase();
});

describe("§16.1 — 8 and 20 concurrent booking attempts produce no more than seven non-overlapping confirmations when seven suites are free", () => {
  for (const attempts of [8, 20]) {
    it(`confirms at most seven of ${attempts} simultaneous attempts`, async (ctx) => {
      if (!up) ctx.skip();

      const outcomes = await raceForSlot(attempts, {
        startsAt: SLOT,
        durationHours: DURATION,
        bufferMinutes: BUFFER,
        holdMinutes: HOLD,
      });

      const confirmed = outcomes.filter((outcome) => outcome.ok);

      expect(confirmed.length).toBeLessThanOrEqual(7);

      expect(confirmed.length).toBe(7);

      const suiteIds = confirmed.map((outcome) => outcome.suiteId);
      expect(new Set(suiteIds).size).toBe(confirmed.length);

      for (const lost of outcomes.filter((outcome) => !outcome.ok)) {
        expect(lost.suiteId).toBeNull();
        expect(lost.error).toBe("no_suite");
      }
    });
  }

  it("leaves no two active claims overlapping on the same suite [INV-02]", async (ctx) => {
    if (!up) ctx.skip();

    await raceForSlot(20, {
      startsAt: SLOT,
      durationHours: DURATION,
      bufferMinutes: BUFFER,
      holdMinutes: HOLD,
    });

    const rows = await activeOccupancy();
    expect(rows).toHaveLength(7);
    expect(overlappingPairs(rows)).toEqual([]);
  });
});

describe("§16.1 — one free suite and multiple concurrent requests produce no more than one confirmation", () => {
  beforeEach(async () => {
    if (up) await resetSuites({ available: 1 });
  });

  for (const attempts of [8, 20]) {
    it(`confirms exactly one of ${attempts} simultaneous attempts`, async (ctx) => {
      if (!up) ctx.skip();

      const outcomes = await raceForSlot(attempts, {
        startsAt: SLOT,
        durationHours: DURATION,
        bufferMinutes: BUFFER,
        holdMinutes: HOLD,
      });

      const confirmed = outcomes.filter((outcome) => outcome.ok);
      expect(confirmed).toHaveLength(1);

      const rows = await activeOccupancy();
      expect(rows).toHaveLength(1);
      expect(overlappingPairs(rows)).toEqual([]);
    });
  }
});

describe("§16.1 — a blocked, maintenance, not-ready or out-of-service suite is never allocated", () => {
  for (const status of ["blocked", "maintenance", "not_ready", "out_of_service"]) {
    it(`never allocates a suite that is ${status.replaceAll("_", " ")}`, async (ctx) => {
      if (!up) ctx.skip();

      await resetSuites({ available: 1, unavailableStatus: status });

      const outcomes = await raceForSlot(20, {
        startsAt: SLOT,
        durationHours: DURATION,
        bufferMinutes: BUFFER,
        holdMinutes: HOLD,
      });

      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    });
  }
});
