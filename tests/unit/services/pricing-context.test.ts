import { describe, expect, it } from "vitest";

import { dubaiContextFor } from "@/lib/services/pricing-service";

describe("§13 / INV-24 — pricing reasons about the Dubai wall clock, not UTC", () => {
  it("reads a Dubai morning from a UTC instant four hours earlier", () => {
    const context = dubaiContextFor("2026-09-14T06:00:00.000Z", 3);

    expect(context.isoDate).toBe("2026-09-14");
    expect(context.startMinutes).toBe(10 * 60);
    expect(context.durationHours).toBe(3);
  });

  it("keeps a late-evening booking on the Dubai day it belongs to", () => {
    const context = dubaiContextFor("2026-09-14T19:30:00.000Z", 2);

    expect(context.isoDate).toBe("2026-09-14");
    expect(context.startMinutes).toBe(23 * 60 + 30);
  });

  it("rolls to the next Dubai day after Dubai midnight, not after UTC midnight", () => {
    const context = dubaiContextFor("2026-09-14T21:00:00.000Z", 2);

    expect(context.isoDate).toBe("2026-09-15");
    expect(context.startMinutes).toBe(60);
  });

  it("numbers the weekday from Sunday, matching the seeded price rules", () => {
    expect(dubaiContextFor("2026-09-13T08:00:00.000Z", 2).weekday).toBe(0);
    expect(dubaiContextFor("2026-09-14T08:00:00.000Z", 2).weekday).toBe(1);
    expect(dubaiContextFor("2026-09-19T08:00:00.000Z", 2).weekday).toBe(6);
  });

  it("agrees with the weekday the availability service already uses", () => {
    const instant = new Date("2026-09-14T08:00:00.000Z");
    const dubaiWeekday = new Date(
      instant.toLocaleString("en-US", { timeZone: "Asia/Dubai" }),
    ).getDay();

    expect(dubaiContextFor(instant.toISOString(), 2).weekday).toBe(dubaiWeekday);
  });
});
