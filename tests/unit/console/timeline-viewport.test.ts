import { describe, expect, it } from "vitest";
import { centredScroll } from "@/components/console/reception/timeline-viewport";
import { TIMELINE_SCALE } from "@/lib/config/reception-display";
import { axisMarks } from "@/components/console/reception/board-types";

describe("Reception timeline zoom", () => {
  it("keeps the time at the centre when zooming in", () => {
    expect(centredScroll({ left: 300, width: 600, track: 1200 }, { left: 300, width: 600, track: 48000 })).toBe(23700);
  });
  it("clamps to the start and end when zooming out", () => {
    expect(centredScroll({ left: 0, width: 600, track: 48000 }, { left: 0, width: 600, track: 1200 })).toBe(0);
    expect(centredScroll({ left: 47400, width: 600, track: 48000 }, { left: 47400, width: 600, track: 1200 })).toBe(600);
  });
  it("handles a track that has not been measured yet", () => {
    expect(centredScroll({ left: 0, width: 0, track: 0 }, { left: 0, width: 600, track: 1200 })).toBe(0);
  });
  it("draws individual minute marks independently of the booking grid", () => {
    const marks = axisMarks({ start: "2026-09-08T06:00:00Z", end: "2026-09-08T06:05:00Z" }, TIMELINE_SCALE.minute.stepMinutes);
    expect(marks).toHaveLength(6);
    expect(Date.parse(marks[1]) - Date.parse(marks[0])).toBe(60_000);
  });
});

import { centredTimeScroll } from "@/components/console/reception/timeline-viewport";
it("[OUR CHOICE] keeps 16:00 centered when opening hours expand onto a 24-hour track", () => {
  expect(centredTimeScroll({left:0,width:600,track:600},{left:0,width:600,track:1200},
    {start:"2026-09-10T10:00:00+04:00",end:"2026-09-10T22:00:00+04:00"},
    {start:"2026-09-10T00:00:00+04:00",end:"2026-09-11T00:00:00+04:00"})).toBe(500);
});
