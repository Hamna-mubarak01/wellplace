import { describe, expect, it } from "vitest";

import { resolveBoardView } from "@/components/console/reception/board-view-config";
import { isScheduleDate, monthSelection } from "@/lib/console/schedule-range";
import { monthRange, weekRange } from "@/lib/services/board-service";

describe("§9.1 — week and month views", () => {
  it("starts the week on Monday and runs seven days", () => {
    const range = weekRange("2026-09-10");

    expect(range.days).toHaveLength(7);
    expect(range.from).toBe("2026-09-07");
    expect(range.to).toBe("2026-09-13");
  });

  it("keeps a Monday in its own week rather than the previous one", () => {
    expect(weekRange("2026-09-07").from).toBe("2026-09-07");
  });

  it("keeps a Sunday in the week that began the Monday before", () => {
    expect(weekRange("2026-09-13").from).toBe("2026-09-07");
  });

  it("renders a month as six full weeks so the grid never reflows", () => {
    const range = monthRange("2026-09-15");

    expect(range.days).toHaveLength(42);
    expect(range.days[0]).toBe("2026-08-31");
    expect(range.days.at(-1)).toBe("2026-10-11");
  });

  it("includes every day of the month it was asked for", () => {
    const range = monthRange("2026-09-15");
    const september = range.days.filter((day) => day.startsWith("2026-09"));

    expect(september).toHaveLength(30);
  });

  it("handles a month that starts on a Monday without a blank leading week", () => {
    const range = monthRange("2026-06-15");

    expect(range.days[0]).toBe("2026-06-01");
  });
});

describe("[CLIENT] Month date ranges stay in the calendar", () => {
  it("pads a range across months to complete Monday–Sunday rows", () => {
    const { selected, calendar } = monthSelection("2026-09-29", "2026-10-02");
    expect(selected?.days).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(calendar.from).toBe("2026-09-28");
    expect(calendar.to).toBe("2026-10-04");
    expect(calendar.days).toHaveLength(7);
  });
  it("clears back to the ordinary month for absent, invalid, single or reversed ranges", () => {
    for (const end of [undefined, "not-a-date", "2026-09-31", "2026-09-10", "2026-09-01"]) {
      const result = monthSelection("2026-09-10", end);
      expect(result.selected).toBeNull();
      expect(result.calendar).toEqual(monthRange("2026-09-10"));
    }
  });
  it("handles leap days, year boundaries and the configured range limit", () => {
    expect(monthSelection("2028-02-28", "2028-03-01").selected?.days).toContain("2028-02-29");
    expect(monthSelection("2026-12-31", "2027-01-02").selected?.days).toHaveLength(3);
    const long = monthSelection("2026-09-01", "2027-01-01");
    expect(long.selected?.days).toHaveLength(31);
    expect(long.calendar.days.length % 7).toBe(0);
  });
  it("maps old Suite status and Date range URLs to supported views", () => {
    expect(resolveBoardView("floor", "month")).toBe("day");
    expect(resolveBoardView("range")).toBe("month");
    expect(resolveBoardView("unknown", "week")).toBe("week");
    expect(isScheduleDate("2026-02-30")).toBe(false);
    expect(isScheduleDate("2028-02-29")).toBe(true);
  });
});
