import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  activeOccupancy, claimDatabase, clearCleaningTasks, confirmCleaning,
  countAvailableSuites, harnessIsUp, leaveSuiteAwaitingCleaning, overlappingPairs,
  raceForSlot, releaseDatabase, requireSeededReferenceData, resetSuites,
  suiteIdsByPriority, withClient, type RaceRequest,
} from "./support/harness";

const REQUEST: RaceRequest = {
  startsAt: new Date("2026-12-14T06:00:00.000Z"),
  durationHours: requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0],
  bufferMinutes: requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes"),
  holdMinutes: requireSetting(EMPTY_SNAPSHOT, "hold.minutes"),
};
const SUITES = 7;
const ATTEMPTS = 20;
let up = false;
let suiteIds: string[] = [];

beforeAll(async () => {
  up = await harnessIsUp();
  if (!up) return;
  await claimDatabase();
  await requireSeededReferenceData();
});
beforeEach(async () => {
  if (!up) return;
  await clearCleaningTasks();
  await resetSuites();
  suiteIds = await suiteIdsByPriority();
  for (const id of suiteIds.slice(0, 3)) {
    await leaveSuiteAwaitingCleaning(id, new Date("2026-12-14T05:00:00Z"));
  }
});
afterAll(async () => {
  if (up) { await clearCleaningTasks(); await resetSuites(); }
  await releaseDatabase();
});

async function manualStatus(status: "not_ready" | "available") {
  await withClient(async (client) => {
    await client.query("update public.suites set status=$1::public.suite_status where id=any($2::uuid[])", [status, suiteIds.slice(0, 3)]);
  });
}

describe("[CLIENT, §7.5] automatic buffer release and manual cleaning holds", () => {
  it("unconfirmed tasks do not reduce the seven suites available to twenty simultaneous attempts", async (ctx) => {
    if (!up) ctx.skip();
    expect(await countAvailableSuites(REQUEST)).toBe(SUITES);
    const winners = (await raceForSlot(ATTEMPTS, REQUEST)).filter((outcome) => outcome.ok);
    expect(winners).toHaveLength(SUITES);
    expect(new Set(winners.map((outcome) => outcome.suiteId)).size).toBe(SUITES);
    expect(overlappingPairs(await activeOccupancy())).toEqual([]);
    expect(await countAvailableSuites(REQUEST)).toBe(0);
  });
  it("twenty attempts cannot allocate any of three manually held suites", async (ctx) => {
    if (!up) ctx.skip();
    await manualStatus("not_ready");
    expect(await countAvailableSuites(REQUEST)).toBe(4);
    const winners = (await raceForSlot(ATTEMPTS, REQUEST)).filter((outcome) => outcome.ok);
    expect(winners).toHaveLength(4);
    for (const winner of winners) expect(suiteIds.slice(0, 3)).not.toContain(winner.suiteId);
    expect(overlappingPairs(await activeOccupancy())).toEqual([]);
  });
  it("task confirmation alone never releases an explicit hold", async (ctx) => {
    if (!up) ctx.skip();
    await manualStatus("not_ready");
    for (const id of suiteIds.slice(0, 3)) await confirmCleaning(id);
    expect(await countAvailableSuites(REQUEST)).toBe(4);
  });
  it("marking held suites Available restores the same capacity allocation can use", async (ctx) => {
    if (!up) ctx.skip();
    await manualStatus("not_ready");
    expect(await countAvailableSuites(REQUEST)).toBe(4);
    await manualStatus("available");
    expect(await countAvailableSuites(REQUEST)).toBe(SUITES);
    expect((await raceForSlot(ATTEMPTS, REQUEST)).filter((outcome) => outcome.ok)).toHaveLength(SUITES);
    expect(overlappingPairs(await activeOccupancy())).toEqual([]);
  });
});
