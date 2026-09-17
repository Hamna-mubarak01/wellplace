import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  blockedPeriod,
  experiencePeriod,
  nextStartOnGrid,
} from "@/lib/domain/buffer";

const dubai = (isoLocal: string) => new Date(`${isoLocal}+04:00`);

describe("§16.1 — the 20-minute buffer prevents a following booking; after an 11:00 end, the next start in the 15-minute grid is 11:30", () => {
  const bufferMinutes = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
  const interval = requireSetting(EMPTY_SNAPSHOT, "booking.start_interval_minutes");

  it("reads 20 minutes and a 15-minute grid from configuration, never a literal", () => {
    expect(bufferMinutes).toBe(20);
    expect(interval).toBe(15);
  });

  it("blocks the suite until 11:20 after a booking that ends at 11:00", () => {
    const experience = experiencePeriod(dubai("2026-09-01T09:00:00"), 2);
    expect(experience.end).toEqual(dubai("2026-09-01T11:00:00"));

    const blocked = blockedPeriod(experience, bufferMinutes);
    expect(blocked.start).toEqual(experience.start);
    expect(blocked.end).toEqual(dubai("2026-09-01T11:20:00"));
  });

  it("offers 11:30 as the next start for that suite, not 11:20 and not 11:15", () => {
    const blocked = blockedPeriod(
      experiencePeriod(dubai("2026-09-01T09:00:00"), 2),
      bufferMinutes,
    );

    const next = nextStartOnGrid(blocked.end, interval);

    expect(next).toEqual(dubai("2026-09-01T11:30:00"));
    expect(next).not.toEqual(dubai("2026-09-01T11:20:00"));
    expect(next).not.toEqual(dubai("2026-09-01T11:15:00"));
  });
});

describe("nextStartOnGrid — §7.1 'on the hour, quarter past, half past and quarter to'", () => {
  it("returns the instant unchanged when it already sits on the grid", () => {
    for (const at of ["10:00", "10:15", "10:30", "10:45"]) {
      const onGrid = dubai(`2026-09-01T${at}:00`);
      expect(nextStartOnGrid(onGrid, 15)).toEqual(onGrid);
    }
  });

  it("rounds up, never down — a suite free at 11:20 is not offered at 11:15", () => {
    expect(nextStartOnGrid(dubai("2026-09-01T11:01:00"), 15)).toEqual(dubai("2026-09-01T11:15:00"));
    expect(nextStartOnGrid(dubai("2026-09-01T11:16:00"), 15)).toEqual(dubai("2026-09-01T11:30:00"));
    expect(nextStartOnGrid(dubai("2026-09-01T11:44:59"), 15)).toEqual(dubai("2026-09-01T11:45:00"));
  });

  it("crosses the hour rather than offering a start past the end of it", () => {
    expect(nextStartOnGrid(dubai("2026-09-01T11:46:00"), 15)).toEqual(dubai("2026-09-01T12:00:00"));
  });

  it("anchors the grid to the hour, so a changed interval stays on clock times [§10.2]", () => {
    expect(nextStartOnGrid(dubai("2026-09-01T11:01:00"), 30)).toEqual(dubai("2026-09-01T11:30:00"));
    expect(nextStartOnGrid(dubai("2026-09-01T11:31:00"), 30)).toEqual(dubai("2026-09-01T12:00:00"));
    expect(nextStartOnGrid(dubai("2026-09-01T11:01:00"), 60)).toEqual(dubai("2026-09-01T12:00:00"));

    expect(nextStartOnGrid(dubai("2026-09-01T11:55:00"), 50)).toEqual(dubai("2026-09-01T12:00:00"));
  });

  it("is stable across a day boundary in Dubai time", () => {
    expect(nextStartOnGrid(dubai("2026-09-01T23:50:00"), 15)).toEqual(dubai("2026-09-02T00:00:00"));
  });
});

describe("blockedPeriod — §7.1 'the buffer applies to online, Reception, walk-in, manual and complimentary bookings'", () => {
  const experience = experiencePeriod(dubai("2026-09-01T09:00:00"), 3);

  it("always contains the experience, which the database also checks", () => {
    const blocked = blockedPeriod(experience, 20);
    expect(blocked.start.getTime()).toBeLessThanOrEqual(experience.start.getTime());
    expect(blocked.end.getTime()).toBeGreaterThanOrEqual(experience.end.getTime());
  });

  it("collapses to the experience when the buffer is configured to zero", () => {
    expect(blockedPeriod(experience, 0)).toEqual(experience);
  });

  it("refuses a negative buffer rather than silently shortening the block", () => {
    expect(() => blockedPeriod(experience, -5)).toThrow();
  });
});

describe("experiencePeriod — §6.1 'a duration of 2, 3, 4, 5 or 6 full hours'", () => {
  it("covers every duration the contract offers", () => {
    const durations = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours");
    expect(durations).toEqual([2, 3, 4, 5, 6]);

    for (const hours of durations) {
      const period = experiencePeriod(dubai("2026-09-01T09:00:00"), hours);
      const spanHours = (period.end.getTime() - period.start.getTime()) / 3_600_000;
      expect(spanHours).toBe(hours);
    }
  });

  it("refuses a zero or negative duration", () => {
    expect(() => experiencePeriod(dubai("2026-09-01T09:00:00"), 0)).toThrow();
    expect(() => experiencePeriod(dubai("2026-09-01T09:00:00"), -2)).toThrow();
  });
});
