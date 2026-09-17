import { describe, expect, it } from "vitest";
import { suiteBlockWindow } from "@/lib/validation/suite-block";

describe("[§10.3] Dubai suite block periods", () => {
  it("covers a complete day through the following midnight", () => {
    expect(suiteBlockWindow("2026-09-08", "2026-09-08", true)).toEqual({
      ok: true, from: "2026-09-07T20:00:00.000Z", to: "2026-09-08T20:00:00.000Z",
    });
  });
  it("includes the last day across a year boundary", () => {
    expect(suiteBlockWindow("2026-12-31", "2027-01-01", true)).toEqual({
      ok: true, from: "2026-12-30T20:00:00.000Z", to: "2027-01-01T20:00:00.000Z",
    });
  });
  it("preserves exact minutes for timed blocks", () => {
    expect(suiteBlockWindow("2026-09-08T10:07", "2026-09-08T11:23", false)).toEqual({
      ok: true, from: "2026-09-08T06:07:00.000Z", to: "2026-09-08T07:23:00.000Z",
    });
  });
  it.each([
    ["2026-09-09", "2026-09-08", true],
    ["2026-09-08T11:00", "2026-09-08T11:00", false],
    ["2026-09-08T11:00", "2026-09-08T10:59", false],
    ["2026-02-30", "2026-03-01", true],
    ["", "2026-09-08", true],
    ["2026-09-08T09:07Z", "2026-09-08T11:23Z", false],
    ["2026-09-08T25:00", "2026-09-09T10:00", false],
  ])("refuses invalid or reversed periods %s to %s", (from, to, days) => {
    expect(suiteBlockWindow(from as string, to as string, days as boolean).ok).toBe(false);
  });
});
