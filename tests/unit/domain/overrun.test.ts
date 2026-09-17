import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import {
  continuationHourOf,
  lateArrivalMinutes,
  measureOverrun,
  overrunChargeFils,
  overrunRatePerIncrementFils,
  priceOverrun,
} from "@/lib/domain/overrun";

const dubai = (isoLocal: string) => new Date(`${isoLocal}+04:00`);

const incrementMinutes = requireSetting(EMPTY_SNAPSHOT, "overrun.increment_minutes");

describe("§7.6 — only an actual overrun is measured, charged in commenced five-minute increments", () => {
  it("reads the increment from configuration, never a literal", () => {
    expect(incrementMinutes).toBe(5);
  });

  it("charges nothing when the guest leaves on time", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:00:00"),
      incrementMinutes,
    });

    expect(result.overrunMinutes).toBe(0);
    expect(result.chargeableIncrements).toBe(0);
  });

  it("charges nothing when the guest leaves early", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T10:42:00"),
      incrementMinutes,
    });

    expect(result.overrunMinutes).toBe(0);
    expect(result.chargeableIncrements).toBe(0);
  });

  it("charges one commenced increment for a single minute over", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:01:00"),
      incrementMinutes,
    });

    expect(result.overrunMinutes).toBe(1);
    expect(result.chargeableIncrements).toBe(1);
    expect(result.chargeableMinutes).toBe(5);
  });

  it("charges one increment for exactly five minutes, not two", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:05:00"),
      incrementMinutes,
    });

    expect(result.chargeableIncrements).toBe(1);
  });

  it("charges two increments the moment the sixth minute commences", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:06:00"),
      incrementMinutes,
    });

    expect(result.chargeableIncrements).toBe(2);
    expect(result.chargeableMinutes).toBe(10);
  });

  it("rounds a part minute up, because the increment has commenced", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:00:01"),
      incrementMinutes,
    });

    expect(result.overrunMinutes).toBe(1);
    expect(result.chargeableIncrements).toBe(1);
  });

  it("multiplies commenced increments by the increment price", () => {
    const result = measureOverrun({
      scheduledEnd: dubai("2026-09-14T11:00:00"),
      actualEnd: dubai("2026-09-14T11:12:00"),
      incrementMinutes,
    });

    expect(result.chargeableIncrements).toBe(3);
    expect(overrunChargeFils(result, 2_500)).toBe(7_500);
  });

  it("refuses a non-positive increment rather than dividing by zero", () => {
    expect(() =>
      measureOverrun({
        scheduledEnd: dubai("2026-09-14T11:00:00"),
        actualEnd: dubai("2026-09-14T11:10:00"),
        incrementMinutes: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("§9.2 — late arrival is recorded as elapsed whole minutes", () => {
  it("reports zero for an on-time or early arrival", () => {
    expect(
      lateArrivalMinutes(dubai("2026-09-14T10:00:00"), dubai("2026-09-14T09:55:00")),
    ).toBe(0);
    expect(
      lateArrivalMinutes(dubai("2026-09-14T10:00:00"), dubai("2026-09-14T10:00:00")),
    ).toBe(0);
  });

  it("reports whole minutes late, discarding the part minute", () => {
    expect(
      lateArrivalMinutes(dubai("2026-09-14T10:00:00"), dubai("2026-09-14T10:17:45")),
    ).toBe(17);
  });
});

describe("Q-21 — an overrun is charged at the regular rate, per guest, per commenced increment", () => {
  const rateSource = requireSetting(EMPTY_SNAPSHOT, "overrun.rate_source");
  const scheduledEnd = dubai("2026-09-14T12:00:00");
  const bookedMinutes = 120;

  const base = {
    scheduledEnd,
    bookedMinutes,
    incrementMinutes,
    tiers: LAUNCH_PRICE_TIERS,
    fixedFilsPerIncrement: null,
    roundingFils: 50,
  };

  it("defaults to the published regular rate, not the Special Offer rate", () => {
    expect(rateSource).toBe("regular_hourly");
  });

  it("derives AED 18.33 an adult increment and AED 14.17 a child increment from the tiers", () => {
    expect(
      overrunRatePerIncrementFils({
        tiers: LAUNCH_PRICE_TIERS,
        guestKind: "adult",
        continuationHour: continuationHourOf(bookedMinutes),
        rateSource: "regular_hourly",
        incrementMinutes,
        fixedFilsPerIncrement: null,
        roundingFils: 50,
      }),
    ).toBe(1_833);

    expect(
      overrunRatePerIncrementFils({
        tiers: LAUNCH_PRICE_TIERS,
        guestKind: "child",
        continuationHour: continuationHourOf(bookedMinutes),
        rateSource: "regular_hourly",
        incrementMinutes,
        fixedFilsPerIncrement: null,
        roundingFils: 50,
      }),
    ).toBe(1_417);
  });

  it("prices the offer reading lower, which is exactly why it is not the default", () => {
    expect(
      overrunRatePerIncrementFils({
        tiers: LAUNCH_PRICE_TIERS,
        guestKind: "adult",
        continuationHour: continuationHourOf(bookedMinutes),
        rateSource: "offer_hourly",
        incrementMinutes,
        fixedFilsPerIncrement: null,
        roundingFils: 50,
      }),
    ).toBe(1_167);
  });

  it("charges one whole increment for one minute over, for every guest", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "regular_hourly",
    });

    expect(charge.chargeableIncrements).toBe(1);
    expect(charge.totalFils).toBe(2 * 1_833 + 1_417);
  });

  it("prices each guest at the rate for their own kind", () => {
    const adultsOnly = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 3, children: 0 },
      rateSource: "regular_hourly",
    });
    const mixed = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "regular_hourly",
    });

    expect(adultsOnly.totalFils).toBe(5_499);
    expect(mixed.totalFils).toBe(5_083);
    expect(mixed.lines.map((line) => line.guestKind)).toEqual(["adult", "child"]);
  });

  it("multiplies by commenced increments, so six minutes costs two", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:06:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "regular_hourly",
    });

    expect(charge.chargeableIncrements).toBe(2);
    expect(charge.totalFils).toBe(2 * (2 * 1_833 + 1_417));
  });

  it("charges nothing when the guest leaves on time", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:00:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "regular_hourly",
    });

    expect(charge.overrunMinutes).toBe(0);
    expect(charge.totalFils).toBe(0);
  });

  it("uses the fixed amount for every guest kind when configured that way", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "fixed",
      fixedFilsPerIncrement: 2_500,
    });

    expect(charge.totalFils).toBe(7_500);
  });

  it("returns a null total rather than a zero when the fixed amount is unset", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 2, children: 1 },
      rateSource: "fixed",
      fixedFilsPerIncrement: null,
    });

    expect(charge.totalFils).toBeNull();
  });

  it("prices the overrun as the hour after the booked ones, not the first hour", () => {
    expect(continuationHourOf(120)).toBe(3);
    expect(continuationHourOf(150)).toBe(3);
    expect(continuationHourOf(60)).toBe(2);
  });

  it("returns a null total when no tier covers the continuation hour", () => {
    const charge = priceOverrun({
      ...base,
      actualEnd: dubai("2026-09-14T12:01:00"),
      guests: { adults: 2, children: 0 },
      rateSource: "regular_hourly",
      tiers: [],
    });

    expect(charge.totalFils).toBeNull();
  });
});
