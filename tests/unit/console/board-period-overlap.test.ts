import { describe, expect, it, vi } from "vitest";
import type { WellPlaceClient } from "@/lib/db/types";
const mocks = vi.hoisted(() => ({ suites:vi.fn(), occupancy:vi.fn() }));
vi.mock("@/lib/db/queries/board", () => ({ listSuites:mocks.suites,listOccupancy:mocks.occupancy }));
import { getPeriodBoard, customRange } from "@/lib/services/board-service";

describe("[§9.1] Overnight entries in period views", () => {
  it("includes a block on every overlapping Dubai date and excludes the exact end boundary", async () => {
    mocks.suites.mockResolvedValue({ok:true,suites:[]});
    mocks.occupancy.mockResolvedValue([{id:"block",suiteId:"suite",boardState:"block",experienceStart:"2026-09-09T19:00:00Z",experienceEnd:"2026-09-10T20:00:00Z",blockedEnd:"2026-09-10T20:00:00Z"}]);
    const result=await getPeriodBoard({} as WellPlaceClient,{},customRange("2026-09-09","2026-09-11"));
    expect(result.byDay.get("2026-09-09")?.map(entry=>entry.id)).toEqual(["block"]);
    expect(result.byDay.get("2026-09-10")?.map(entry=>entry.id)).toEqual(["block"]);
    expect(result.byDay.get("2026-09-11")).toEqual([]);
    expect(mocks.occupancy).toHaveBeenCalledWith({}, {from:"2026-09-08T20:00:00.000Z",to:"2026-09-11T20:00:00.000Z"});
  });
});
