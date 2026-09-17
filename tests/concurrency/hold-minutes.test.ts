import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  claimDatabase,
  harnessIsUp,
  raceForSlot,
  releaseDatabase,
  requireSeededReferenceData,
  resetSuites,
  withClient,
  withHeldAllocationLock,
  type AttemptOutcome,
  type RaceRequest,
} from "./support/harness";

const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const HOLD = requireSetting(EMPTY_SNAPSHOT, "hold.minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const SLOT = new Date("2026-12-15T06:00:00.000Z");
const ATTEMPTS = 20;
const SUITES = 7;

const REQUEST: RaceRequest = {
  startsAt: SLOT,
  durationHours: DURATION,
  bufferMinutes: BUFFER,
  holdMinutes: HOLD,
};

interface ContendedRace {
  readonly outcomes: readonly AttemptOutcome[];
  readonly lockReleasedAt: string;
}

async function raceBehindTheAllocationLock(): Promise<ContendedRace> {
  return withHeldAllocationLock(async (lock) => {
    const race = raceForSlot(ATTEMPTS, REQUEST);

    await lock.waitUntilBlocked(ATTEMPTS);
    const lockReleasedAt = await lock.releaseAndStamp();

    return { outcomes: await race, lockReleasedAt };
  });
}

async function holdMinutesAfter(
  occupancyId: string,
  instant: string,
): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ minutes: string }>(
      `select extract(epoch from (expires_at - $2::timestamptz)) / 60 as minutes
         from public.suite_occupancy
        where id = $1`,
      [occupancyId, instant],
    );
    return Number(rows[0].minutes);
  });
}

async function queueWaitMinutes(occupancyId: string): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ queued_minutes: string }>(
      `select extract(epoch from (expires_at - created_at)) / 60 as queued_minutes
         from public.suite_occupancy
        where id = $1`,
      [occupancyId],
    );
    return Number(rows[0].queued_minutes);
  });
}

async function claimStartedBefore(
  occupancyId: string,
  instant: string,
): Promise<boolean> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ queued: boolean }>(
      "select created_at < $2::timestamptz as queued from public.suite_occupancy where id = $1",
      [occupancyId, instant],
    );
    return rows[0].queued;
  });
}

let up = false;

beforeAll(async () => {
  up = await harnessIsUp();

  if (!up) {
    console.warn(
      "\n  ⚠ tests/concurrency/hold-minutes skipped — no local Postgres.\n" +
        "    ADR-0001 records this property as found by re-reading and never tested.\n" +
        "    Start the database first: npm run db:test:up && npm run db:migrate\n",
    );
    return;
  }

  await claimDatabase();
  await requireSeededReferenceData();
});

beforeEach(async () => {
  if (up) await resetSuites();
});

afterAll(async () => {
  if (up) await resetSuites();
  await releaseDatabase();
});

describe("§7.3 · ADR-0001 — a contended hold is never shortened below the configured hold length", () => {
  it("gives every winner its full hold measured from the moment the venue-wide lock was released", async (ctx) => {
    if (!up) ctx.skip();

    const { outcomes, lockReleasedAt } = await raceBehindTheAllocationLock();
    const confirmed = outcomes.filter((outcome) => outcome.ok);

    expect(confirmed).toHaveLength(SUITES);

    for (const winner of confirmed) {
      expect(winner.occupancyId).not.toBeNull();

      expect(
        await holdMinutesAfter(winner.occupancyId!, lockReleasedAt),
        "expires_at was computed before the advisory lock was granted, so the wait " +
          "was subtracted from the guest's hold — p_hold_minutes must stay a duration, " +
          "never a caller-computed timestamp",
      ).toBeGreaterThanOrEqual(HOLD);
    }
  }, 60_000);

  it("proves the winners genuinely queued, so the assertion above had something to catch", async (ctx) => {
    if (!up) ctx.skip();

    const { outcomes, lockReleasedAt } = await raceBehindTheAllocationLock();
    const confirmed = outcomes.filter((outcome) => outcome.ok);

    expect(confirmed).toHaveLength(SUITES);

    for (const winner of confirmed) {
      expect(
        await claimStartedBefore(winner.occupancyId!, lockReleasedAt),
        "this attempt began after the lock was released, so it never queued and " +
          "the shortened-hold regression would have slipped past the test above",
      ).toBe(true);

      expect(await queueWaitMinutes(winner.occupancyId!)).toBeGreaterThan(HOLD);
    }
  }, 60_000);

  it("leaves an uncontended hold exactly the configured length, not longer", async (ctx) => {
    if (!up) ctx.skip();

    const [only] = await raceForSlot(1, REQUEST);

    expect(only.ok).toBe(true);
    expect(await queueWaitMinutes(only.occupancyId!)).toBeCloseTo(HOLD, 1);
    expect(HOLD).toBe(10);
  }, 60_000);
});
