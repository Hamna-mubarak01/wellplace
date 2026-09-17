import { describe, expect, it } from "vitest";
import { EMPTY_WEEK, seasonalHoursSchema, type WeeklyHours } from "@/lib/config/opening-hours";
import { replaceScheduleRange, unifiedScheduleRanges } from "@/lib/config/schedule-ranges";
import { schedulePeriodsDraft } from "@/lib/config/schedule-editor";

const hours: WeeklyHours = { ...EMPTY_WEEK, mon: [{ opens: "10:00", closes: "22:00" }] };
const period = { from: "2026-09-01", to: "2026-09-30", hours };

describe("[CLIENT] One schedule editor", () => {
  it("preserves renamed schedules through editing, validation and overlapping date changes", () => {
    const renamed = { ...period, name: "Summer hours" };
    const saved = seasonalHoursSchema.parse(schedulePeriodsDraft.parse({ periods: [renamed] }));
    expect(saved.periods[0]).toEqual(renamed);
    const next = replaceScheduleRange(unifiedScheduleRanges(saved, [], []), { from: "2026-09-10", to: "2026-09-20", hours: EMPTY_WEEK, name: "Holiday closure" });
    expect(next.map((entry) => entry.name)).toEqual(["Summer hours", "Holiday closure", "Summer hours"]);
    expect(next[0].hours).toEqual(hours);
  });
  it("accepts older unnamed schedules and rejects excessively long names", () => {
    expect(seasonalHoursSchema.safeParse({ periods: [period] }).success).toBe(true);
    expect(seasonalHoursSchema.safeParse({ periods: [{ ...period, name: "x".repeat(81) }] }).success).toBe(false);
  });
  it("replaces an inner range while preserving both outer date ranges", () => {
    const next = replaceScheduleRange([period], { from: "2026-09-10", to: "2026-09-20", hours: EMPTY_WEEK });
    expect(next.map(({ from, to }) => [from, to])).toEqual([["2026-09-01", "2026-09-09"], ["2026-09-10", "2026-09-20"], ["2026-09-21", "2026-09-30"]]);
    expect(next[0].hours).toEqual(hours);
    expect(next[2].hours).toEqual(hours);
    expect(seasonalHoursSchema.safeParse({ periods: next }).success).toBe(true);
  });
  it("preserves legacy closure precedence over single-date and weekly hours", () => {
    const next = unifiedScheduleRanges({ periods: [period] }, [{ date: "2026-09-14", windows: [{ opens: "12:00", closes: "18:00" }] }], [{ from: "2026-09-14", to: "2026-09-15" }]);
    expect(next.find((entry) => entry.from === "2026-09-14")?.hours).toEqual(EMPTY_WEEK);
    expect(next.at(-1)?.to).toBe("2026-09-30");
    expect(seasonalHoursSchema.safeParse({ periods: next }).success).toBe(true);
  });
  it("supports one-day closures and split opening windows", () => {
    expect(seasonalHoursSchema.safeParse({ periods: [{ from: "2026-12-31", to: "2026-12-31", hours: EMPTY_WEEK }] }).success).toBe(true);
    expect(seasonalHoursSchema.safeParse({ periods: [{ ...period, hours: { ...hours, mon: [{ opens: "10:00", closes: "12:00" }, { opens: "14:00", closes: "22:00" }] } }] }).success).toBe(true);
  });
});
