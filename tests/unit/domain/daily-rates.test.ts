import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import { dailyFirstHourRates, type PriceTier } from "@/lib/domain/pricing";
import { isoDatesInMonth } from "@/lib/domain/time";

const ROUNDING = requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils");

const tier = (over: Partial<PriceTier>): PriceTier => ({
  id: "base",
  guestKind: "adult",
  fromHour: 1,
  toHour: null,
  regularFilsPerHour: 20_000,
  offerFilsPerHour: 15_000,
  offerPercent: null,
  weekdays: null,
  seasonFrom: null,
  seasonTo: null,
  startWindow: null,
  priority: 0,
  ...over,
});

describe("[CLIENT console redesign brief 2026-09-11; OUR CHOICE] the suite page's per-day rate calendar reads the venue-wide rules", () => {
  it("shows the launch rate on every day of a month, because launch prices do not vary by day", () => {
    const rates = dailyFirstHourRates(LAUNCH_PRICE_TIERS, "adult", isoDatesInMonth(2026, 9), ROUNDING);

    expect(rates).toHaveLength(30);
    expect(new Set(rates.map((rate) => rate.offerFilsPerHour))).toEqual(new Set([16_500]));
    expect(new Set(rates.map((rate) => rate.regularFilsPerHour))).toEqual(new Set([22_000]));
    expect(rates.every((rate) => !rate.varies)).toBe(true);
  });

  it("moves only the weekdays a weekday rule covers", () => {
    const weekend = tier({ id: "weekend", weekdays: [5, 6], offerFilsPerHour: 18_000, priority: 1 });
    const [thursday, friday, saturday, sunday] = dailyFirstHourRates(
      [tier({}), weekend],
      "adult",
      ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"],
      ROUNDING,
    );

    expect(thursday.offerFilsPerHour).toBe(15_000);
    expect(friday.offerFilsPerHour).toBe(18_000);
    expect(saturday.offerFilsPerHour).toBe(18_000);
    expect(sunday.offerFilsPerHour).toBe(15_000);
  });

  it("applies a season only on the dates inside it, both ends included", () => {
    const season = tier({ id: "season", seasonFrom: "2026-12-20", seasonTo: "2026-12-31", offerFilsPerHour: 19_000, priority: 1 });
    const rates = dailyFirstHourRates([tier({}), season], "adult", ["2026-12-19", "2026-12-20", "2026-12-31"], ROUNDING);

    expect(rates.map((rate) => rate.offerFilsPerHour)).toEqual([15_000, 19_000, 19_000]);
  });

  it("marks a day whose rate depends on the start time as varying, and shows the lowest rate", () => {
    const evening = tier({ id: "evening", startWindow: { fromMinutes: 18 * 60, toMinutes: 22 * 60 }, offerFilsPerHour: 12_000, priority: 1 });
    const [day] = dailyFirstHourRates([tier({}), evening], "adult", ["2026-09-14"], ROUNDING);

    expect(day.varies).toBe(true);
    expect(day.offerFilsPerHour).toBe(12_000);
    expect(day.regularFilsPerHour).toBe(20_000);
  });

  it("treats a day that is priced at some start times but not others as varying", () => {
    const morningOnly = tier({ startWindow: { fromMinutes: 9 * 60, toMinutes: 12 * 60 } });
    const [day] = dailyFirstHourRates([morningOnly], "adult", ["2026-09-14"], ROUNDING);

    expect(day.offerFilsPerHour).toBe(15_000);
    expect(day.varies).toBe(true);
  });

  it("derives a percentage offer with the configured rounding", () => {
    const [day] = dailyFirstHourRates([tier({ offerFilsPerHour: null, offerPercent: 25, regularFilsPerHour: 22_000 })], "adult", ["2026-09-14"], ROUNDING);

    expect(day.offerFilsPerHour).toBe(16_500);
  });

  it("returns no rate, never zero, when nothing prices the day", () => {
    const [day] = dailyFirstHourRates([tier({ guestKind: "child" })], "adult", ["2026-09-14"], ROUNDING);

    expect(day).toEqual({ isoDate: "2026-09-14", regularFilsPerHour: null, offerFilsPerHour: null, varies: false });
  });
});

describe("[OUR CHOICE] isoDatesInMonth lists every calendar date of a month", () => {
  it("handles 30-day, 31-day and leap-year months", () => {
    expect(isoDatesInMonth(2026, 9)).toHaveLength(30);
    expect(isoDatesInMonth(2026, 12).at(-1)).toBe("2026-12-31");
    expect(isoDatesInMonth(2028, 2)).toHaveLength(29);
    expect(isoDatesInMonth(2027, 2)[0]).toBe("2027-02-01");
  });
});
