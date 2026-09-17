import { describe, expect, it } from "vitest";
import { changeTimelineSpan, timelineSpanLabel, timelineMarkStep, visitSpanOptions, TIMELINE_SPAN_PRESETS } from "@/lib/config/reception-display";
import { customRange, fullDayWindow } from "@/lib/services/board-service";

describe("[OUR CHOICE] Reception display controls", () => {
  it("changes the visible span by exactly minus one or plus ten minutes", () => {
    expect(changeTimelineSpan(60, "less")).toBe(59);
    expect(changeTimelineSpan(60, "more")).toBe(70);
    expect(changeTimelineSpan(719, "more")).toBe(729);
  });
  it("clamps both ends without going outside one minute and 24 hours", () => {
    expect(changeTimelineSpan(1, "less")).toBe(1);
    expect(changeTimelineSpan(1435, "more")).toBe(1440);
    expect(changeTimelineSpan(1440, "more")).toBe(1440);
  });
  it("keeps minute precision and uses readable hour labels", () => {
    expect(timelineSpanLabel(59)).toBe("59 min");
    expect(timelineSpanLabel(70)).toBe("1 h 10 min");
    expect(timelineSpanLabel(1440)).toBe("24 h");
    expect(timelineMarkStep(1)).toBe(1);
    expect(timelineMarkStep(1440)).toBe(240);
  });
  it("uses an inclusive custom date range over a month boundary", () => {
    expect(customRange("2026-09-29", "2026-10-02").days).toEqual(["2026-09-29","2026-09-30","2026-10-01","2026-10-02"]);
    expect(customRange("2026-09-10", "2026-09-01").days).toEqual(["2026-09-10"]);
    expect(customRange("2026-09-01", "2027-01-01").days).toHaveLength(31);
  });
  it("loads all 24 hours of a Dubai day, including overnight entries", () => {
    expect(fullDayWindow("2026-09-10")).toEqual({start:"2026-09-09T20:00:00.000Z",end:"2026-09-10T20:00:00.000Z"});
  });
});

describe("[CLIENT] Timeline dropdown presets", () => {
  it("offers only the requested time spans independently of bookable visits", () => {
    expect(TIMELINE_SPAN_PRESETS).toEqual([15, 30, 60, 1440]);
  });
});

describe("[CLIENT] Visit durations are their own group in the span menu", () => {
  it("turns the saved visit lengths into minutes, in order", () => {
    expect(visitSpanOptions([2, 3, 4, 5, 6])).toEqual([120, 180, 240, 300, 360]);
    expect(visitSpanOptions([6, 2, 4])).toEqual([120, 240, 360]);
  });
  it("follows the saved setting rather than a fixed list", () => {
    expect(visitSpanOptions([2, 8])).toEqual([120, 480]);
    expect(visitSpanOptions([])).toEqual([]);
  });
  it("never repeats a value the preset group already offers", () => {
    expect(visitSpanOptions([1, 2])).toEqual([120]);
    expect(visitSpanOptions([24, 2])).toEqual([120]);
    for (const minutes of visitSpanOptions([2, 3, 4, 5, 6])) {
      expect(TIMELINE_SPAN_PRESETS).not.toContain(minutes);
    }
  });
  it("drops a duration that could not be displayed", () => {
    expect(visitSpanOptions([0, 2, 25])).toEqual([120]);
  });
  it("collapses a duplicate saved length", () => {
    expect(visitSpanOptions([3, 3, 2])).toEqual([120, 180]);
  });
});
