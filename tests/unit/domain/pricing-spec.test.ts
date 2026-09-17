import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import {
  priceBooking,
  pricePerPerson,
  resolveOfferRate,
  savingPercentOf,
  taxWithin,
  type PriceTier,
  type PricingContext,
} from "@/lib/domain/pricing";

const ROUNDING = requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils");
const VAT = requireSetting(EMPTY_SNAPSHOT, "tax.vat_percent");

const context = (durationHours: number): PricingContext => ({
  isoDate: "2026-09-14",
  weekday: 1,
  startMinutes: 10 * 60,
  durationHours,
});

const person = (kind: "adult" | "child", hours: number) =>
  pricePerPerson(LAUNCH_PRICE_TIERS, kind, context(hours), ROUNDING);

const book = (hours: number, adults: number, children: number) =>
  priceBooking({
    context: context(hours),
    tiers: LAUNCH_PRICE_TIERS,
    guests: { adults, childAges: Array.from({ length: children }, () => 10) },
    addons: [],
    promotion: null,
    serviceFee: null,
    tax: { percent: VAT, inclusive: true, label: "VAT" },
    roundingFils: ROUNDING,
    manualTotalFils: null,
  });

describe("§3 — total price per person by duration", () => {
  const TABLE = [
    { hours: 2, adultRegular: 44_000, adultOffer: 33_000, childRegular: 34_000, childOffer: 25_500 },
    { hours: 3, adultRegular: 66_000, adultOffer: 47_000, childRegular: 51_000, childOffer: 36_500 },
    { hours: 4, adultRegular: 88_000, adultOffer: 61_000, childRegular: 68_000, childOffer: 47_500 },
    { hours: 5, adultRegular: 110_000, adultOffer: 75_000, childRegular: 85_000, childOffer: 58_500 },
    { hours: 6, adultRegular: 132_000, adultOffer: 89_000, childRegular: 102_000, childOffer: 69_500 },
  ] as const;

  for (const row of TABLE) {
    it(`prices ${row.hours} hours exactly as the specification's table does`, () => {
      const adult = person("adult", row.hours);
      const child = person("child", row.hours);

      expect(adult?.regularFils).toBe(row.adultRegular);
      expect(adult?.offerFils).toBe(row.adultOffer);
      expect(child?.regularFils).toBe(row.childRegular);
      expect(child?.offerFils).toBe(row.childOffer);
    });
  }
});

describe("§4 — minimum booking example, two adults", () => {
  const TABLE = [
    { hours: 2, regular: 88_000, offer: 66_000 },
    { hours: 3, regular: 132_000, offer: 94_000 },
    { hours: 4, regular: 176_000, offer: 122_000 },
    { hours: 5, regular: 220_000, offer: 150_000 },
    { hours: 6, regular: 264_000, offer: 178_000 },
  ] as const;

  for (const row of TABLE) {
    it(`totals ${row.hours} hours for two adults exactly as the specification does`, () => {
      const result = book(row.hours, 2, 0);

      expect(result.regularTotalFils).toBe(row.regular);
      expect(result.totalFils).toBe(row.offer);
    });
  }

  it("the headline minimum is AED 660 for two adults for two hours", () => {
    expect(book(2, 2, 0).totalFils).toBe(66_000);
  });
});

describe("§5 — calculation logic", () => {
  it("adult regular is duration times AED 220", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      expect(person("adult", hours)?.regularFils).toBe(hours * 22_000);
    }
  });

  it("adult offer is AED 330 for the first two hours plus AED 140 each after", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      expect(person("adult", hours)?.offerFils).toBe(33_000 + (hours - 2) * 14_000);
    }
  });

  it("child regular is duration times AED 170", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      expect(person("child", hours)?.regularFils).toBe(hours * 17_000);
    }
  });

  it("child offer is AED 255 for the first two hours plus AED 110 each after", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      expect(person("child", hours)?.offerFils).toBe(25_500 + (hours - 2) * 11_000);
    }
  });

  it("the mixed-group example totals AED 1,695 including VAT", () => {
    const result = book(4, 2, 1);

    expect(result.totalFils).toBe(169_500);
    expect(2 * 61_000 + 1 * 47_500).toBe(169_500);
  });

  it("calculates adult and child totals independently, then adds them", () => {
    const mixed = book(4, 2, 1);
    const adultsOnly = book(4, 2, 0);
    const childOnly = book(4, 0, 1);

    expect(mixed.totalFils).toBe(adultsOnly.totalFils + childOnly.totalFils);
  });
});

describe("§2 — displayed savings", () => {
  it("shows 25% off the first two hours for an adult and for a child", () => {
    expect(savingPercentOf(22_000, 16_500)).toBe(25);
    expect(savingPercentOf(17_000, 12_750)).toBe(25);
  });

  it("shows 36% off additional adult hours and 35% off additional child hours", () => {
    expect(savingPercentOf(22_000, 14_000)).toBe(36);
    expect(savingPercentOf(17_000, 11_000)).toBe(35);
  });

  it("rounds a displayed percentage normally, to the nearest whole percent", () => {
    expect(savingPercentOf(22_000, 14_000)).toBe(36);
    expect(savingPercentOf(17_000, 11_000)).toBe(35);
    expect(savingPercentOf(10_000, 10_000)).toBe(0);
  });
});

describe("§2 — offer prices derived from a percentage round to the nearest AED 0.50", () => {
  const derived = (regularFilsPerHour: number, offerPercent: number): PriceTier => ({
    id: "derived",
    guestKind: "adult",
    fromHour: 1,
    toHour: null,
    regularFilsPerHour,
    offerFilsPerHour: null,
    offerPercent,
    weekdays: null,
    seasonFrom: null,
    seasonTo: null,
    startWindow: null,
    priority: 0,
  });

  it("rounds AED 127.40 up to AED 127.50", () => {
    expect(resolveOfferRate(derived(12_740, 0.0001), ROUNDING)).toBe(12_750);
  });

  it("rounds AED 127.20 down to AED 127.00", () => {
    expect(resolveOfferRate(derived(12_720, 0.0001), ROUNDING)).toBe(12_700);
  });

  it("derives the child first-two-hour rate of AED 127.50 from 25% off AED 170", () => {
    expect(resolveOfferRate(derived(17_000, 25), ROUNDING)).toBe(12_750);
  });

  it("uses a configured absolute rate as-is, without rounding it", () => {
    expect(resolveOfferRate(LAUNCH_PRICE_TIERS[0], ROUNDING)).toBe(16_500);
  });
});

describe("§1 — VAT is 5% and included in every displayed and calculated amount", () => {
  it("takes the VAT out of the gross rather than adding it on top", () => {
    const result = book(2, 2, 0);

    expect(result.totalFils).toBe(66_000);
    expect(result.taxIsIncluded).toBe(true);
    expect(result.taxFils).toBe(taxWithin(66_000, VAT));
    expect(result.taxFils).toBe(3_143);
    expect(result.netFils).toBe(62_857);
  });

  it("keeps the net plus the VAT equal to the amount payable", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      const result = book(hours, 2, 1);
      expect(result.netFils + result.taxFils).toBe(result.totalFils);
    }
  });

  it("never lets an inclusive VAT change the amount the guest pays", () => {
    const withVat = book(4, 2, 1);
    const withoutVat = priceBooking({
      context: context(4),
      tiers: LAUNCH_PRICE_TIERS,
      guests: { adults: 2, childAges: [10] },
      addons: [],
      promotion: null,
      serviceFee: null,
      tax: null,
      roundingFils: ROUNDING,
      manualTotalFils: null,
    });

    expect(withVat.totalFils).toBe(withoutVat.totalFils);
  });
});

describe("§1 — booking rules at launch", () => {
  it("offers 2 to 6 hours and never a one-hour booking", () => {
    const durations = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours");

    expect([...durations]).toEqual([2, 3, 4, 5, 6]);
    expect(durations).not.toContain(1);
  });

  it("allows a minimum of 2 and a maximum of 5 guests", () => {
    expect(requireSetting(EMPTY_SNAPSHOT, "booking.guests_min")).toBe(2);
    expect(requireSetting(EMPTY_SNAPSHOT, "booking.guests_max")).toBe(5);
  });

  it("prices the same on every weekday and at every time of day", () => {
    const monday = { ...context(4), weekday: 1, startMinutes: 10 * 60 };
    const friday = { ...context(4), weekday: 5, startMinutes: 20 * 60 };

    expect(pricePerPerson(LAUNCH_PRICE_TIERS, "adult", monday, ROUNDING)).toEqual(
      pricePerPerson(LAUNCH_PRICE_TIERS, "adult", friday, ROUNDING),
    );
  });
});
