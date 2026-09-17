import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import {
  percentOfFils,
  priceBooking,
  selectTier,
  taxWithin,
  type AddonSelection,
  type PricingContext,
  type PricingInput,
} from "@/lib/domain/pricing";

const ROUNDING = requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils");

const CONTEXT: PricingContext = {
  isoDate: "2026-09-14",
  weekday: 1,
  startMinutes: 10 * 60,
  durationHours: 2,
};

const addon = (over: Partial<AddonSelection> = {}): AddonSelection => ({
  id: "robe",
  name: "Bathrobe",
  regularUnitPriceFils: 3_000,
  unitPriceFils: 3_000,
  quantity: 1,
  isLocked: false,
  ...over,
});

const input = (over: Partial<PricingInput> = {}): PricingInput => ({
  context: CONTEXT,
  tiers: LAUNCH_PRICE_TIERS,
  guests: { adults: 2, childAges: [] },
  addons: [],
  promotion: null,
  serviceFee: null,
  tax: null,
  roundingFils: ROUNDING,
  manualTotalFils: null,
  ...over,
});

describe("§16.1 — service-fee activation, deactivation, percentage, label, payment, refund and Reporting are calculated correctly", () => {
  const percent = requireSetting(EMPTY_SNAPSHOT, "fees.tabby.percent");
  const label = requireSetting(EMPTY_SNAPSHOT, "fees.tabby.label");

  it("reads 6% and the label from configuration, never a literal", () => {
    expect(percent).toBe(6);
    expect(label).toBe("Service Fee");
  });

  it("INV-19 — charges the fee on the order value before the fee, and never compounds", () => {
    const result = priceBooking(
      input({ serviceFee: { enabled: true, percent, label } }),
    );

    expect(result.orderValueFils).toBe(66_000);
    expect(result.serviceFeeFils).toBe(3_960);
    expect(result.totalFils).toBe(69_960);
  });

  it("does not charge a fee on the fee when the same order is priced twice", () => {
    const once = priceBooking(input({ serviceFee: { enabled: true, percent, label } }));
    const again = priceBooking(input({ serviceFee: { enabled: true, percent, label } }));

    expect(again.serviceFeeFils).toBe(once.serviceFeeFils);
    expect(again.totalFils).toBe(once.totalFils);
  });

  it("computes the fee on the discounted order value, not the regular price", () => {
    const result = priceBooking(
      input({
        promotion: { code: "SAVE10", kind: "percent", amountFils: null, percent: 10 },
        serviceFee: { enabled: true, percent, label },
      }),
    );

    expect(result.discountFils).toBe(6_600);
    expect(result.orderValueFils).toBe(59_400);
    expect(result.serviceFeeFils).toBe(3_564);
  });

  it("drops the fee line entirely when the method is disabled", () => {
    const result = priceBooking(
      input({ serviceFee: { enabled: false, percent, label } }),
    );

    expect(result.serviceFeeFils).toBe(0);
    expect(result.lines.some((line) => line.kind === "service_fee")).toBe(false);
  });

  it("carries the configured label onto the fee line", () => {
    const result = priceBooking(
      input({ serviceFee: { enabled: true, percent, label } }),
    );

    expect(result.lines.find((line) => line.kind === "service_fee")?.label).toBe(label);
  });
});

describe("§6.4 — genuine promotions show the real regular price, the reduced price and the actual saving", () => {
  it("crosses out the real regular total and reports the actual saving", () => {
    const result = priceBooking(input());

    expect(result.regularTotalFils).toBe(88_000);
    expect(result.totalFils).toBe(66_000);
    expect(result.savingFils).toBe(22_000);
    expect(result.savingPercent).toBe(25);
  });

  it("applies a promotion code on top of the offer price", () => {
    const result = priceBooking(
      input({
        promotion: { code: "FIXED", kind: "fixed", amountFils: 6_000, percent: null },
      }),
    );

    expect(result.discountFils).toBe(6_000);
    expect(result.totalFils).toBe(60_000);
    expect(result.promotionApplied).toBe(true);
  });

  it("never discounts below zero", () => {
    const result = priceBooking(
      input({
        promotion: { code: "HUGE", kind: "fixed", amountFils: 999_999, percent: null },
      }),
    );

    expect(result.discountFils).toBe(66_000);
    expect(result.totalFils).toBe(0);
  });

  it("reports no promotion when none is applied", () => {
    expect(priceBooking(input()).promotionApplied).toBe(false);
  });
});

describe("§6.2 — adults and children are priced from their own tiers", () => {
  it("prices each child from the child tier, not the adult one", () => {
    const result = priceBooking(input({ guests: { adults: 2, childAges: [9, 12] } }));

    expect(result.totalFils).toBe(2 * 33_000 + 2 * 25_500);
  });

  it("prices every child in the 8-15 band identically", () => {
    const young = priceBooking(input({ guests: { adults: 2, childAges: [8] } }));
    const old = priceBooking(input({ guests: { adults: 2, childAges: [15] } }));

    expect(young.totalFils).toBe(old.totalFils);
  });
});

describe("no tier covers the request, so the engine invents no price", () => {
  it("returns the no_tier outcome and a zero total", () => {
    const result = priceBooking(input({ tiers: [] }));

    expect(result.outcome).toBe("no_tier");
    expect(result.totalFils).toBe(0);
    expect(result.lines).toHaveLength(0);
  });

  it("prices from an agreed amount without consulting a tier", () => {
    const result = priceBooking(input({ tiers: [], manualTotalFils: 25_000 }));

    expect(result.outcome).toBe("manual");
    expect(result.totalFils).toBe(25_000);
  });

  it("still reports the VAT inside an agreed amount", () => {
    const result = priceBooking(
      input({
        tiers: [],
        manualTotalFils: 66_000,
        tax: { percent: 5, inclusive: true, label: "VAT" },
      }),
    );

    expect(result.taxFils).toBe(taxWithin(66_000, 5));
    expect(result.netFils + result.taxFils).toBe(66_000);
  });
});

describe("§10.4 — tiers select by hour, weekday, season and time window", () => {
  it("picks the first-two-hour tier for hour 1 and the additional tier for hour 3", () => {
    expect(selectTier(LAUNCH_PRICE_TIERS, "adult", 1, CONTEXT)?.id).toBe("adult-first-two");
    expect(selectTier(LAUNCH_PRICE_TIERS, "adult", 3, CONTEXT)?.id).toBe("adult-additional");
  });

  it("keeps the open-ended tier covering every hour beyond its start", () => {
    expect(selectTier(LAUNCH_PRICE_TIERS, "adult", 6, CONTEXT)?.id).toBe("adult-additional");
    expect(selectTier(LAUNCH_PRICE_TIERS, "adult", 99, CONTEXT)?.id).toBe("adult-additional");
  });

  it("never returns a tier for the wrong guest type", () => {
    expect(selectTier(LAUNCH_PRICE_TIERS, "child", 1, CONTEXT)?.guestKind).toBe("child");
  });

  it("excludes a tier whose weekday, season or window does not match", () => {
    const restricted = LAUNCH_PRICE_TIERS.map((tier) => ({ ...tier, weekdays: [5] }));
    expect(selectTier(restricted, "adult", 1, CONTEXT)).toBeNull();

    const future = LAUNCH_PRICE_TIERS.map((tier) => ({ ...tier, seasonFrom: "2026-10-01" }));
    expect(selectTier(future, "adult", 1, CONTEXT)).toBeNull();

    const evening = LAUNCH_PRICE_TIERS.map((tier) => ({
      ...tier,
      startWindow: { fromMinutes: 18 * 60, toMinutes: 22 * 60 },
    }));
    expect(selectTier(evening, "adult", 1, CONTEXT)).toBeNull();
  });

  it("prefers the higher priority tier", () => {
    const seasonal = { ...LAUNCH_PRICE_TIERS[0], id: "seasonal", priority: 10 };
    expect(selectTier([...LAUNCH_PRICE_TIERS, seasonal], "adult", 1, CONTEXT)?.id).toBe(
      "seasonal",
    );
  });
});

describe("§11.2 — add-ons are priced as their own lines so reporting never recomputes", () => {
  it("adds one line per selected add-on and folds it into the order value", () => {
    const result = priceBooking(
      input({
        addons: [addon(), addon({ id: "tea", name: "Tea", regularUnitPriceFils: 1_500, unitPriceFils: 1_500 })],
      }),
    );

    expect(result.addonsTotalFils).toBe(4_500);
    expect(result.orderValueFils).toBe(70_500);
    expect(result.lines.filter((line) => line.kind === "addon")).toHaveLength(2);
  });

  it("multiplies an add-on by its quantity", () => {
    const result = priceBooking(input({ addons: [addon({ quantity: 3 })] }));
    expect(result.addonsTotalFils).toBe(9_000);
  });

  it("ignores an add-on with no quantity", () => {
    expect(priceBooking(input({ addons: [addon({ quantity: 0 })] })).addonsTotalFils).toBe(0);
  });

  it("§8 — an add-on priced at zero is marked included and adds nothing", () => {
    const result = priceBooking(
      input({ addons: [addon({ unitPriceFils: 0, regularUnitPriceFils: 4_000 })] }),
    );

    expect(result.addonsTotalFils).toBe(0);
    expect(result.totalFils).toBe(66_000);

    const line = result.lines.find((row) => row.kind === "addon");
    expect(line?.isIncluded).toBe(true);
    expect(line?.regularUnitPriceFils).toBe(4_000);
  });

  it("§8 — a paid add-on is never marked included", () => {
    const result = priceBooking(input({ addons: [addon()] }));
    expect(result.lines.find((row) => row.kind === "addon")?.isIncluded).toBe(false);
  });

  it("never discounts an add-on with a booking promotion", () => {
    const result = priceBooking(
      input({
        addons: [addon()],
        promotion: { code: "SAVE10", kind: "percent", amountFils: null, percent: 10 },
      }),
    );

    expect(result.discountFils).toBe(6_600);
    expect(result.addonsTotalFils).toBe(3_000);
  });
});

describe("Q-4 — VAT is 5% and included, per the launch pricing specification", () => {
  it("reads 5%, the inclusive treatment and the label from configuration", () => {
    expect(requireSetting(EMPTY_SNAPSHOT, "tax.vat_percent")).toBe(5);
    expect(requireSetting(EMPTY_SNAPSHOT, "tax.inclusive")).toBe(true);
    expect(requireSetting(EMPTY_SNAPSHOT, "tax.label")).toBe("VAT");
  });

  it("charges no tax and renders no tax line when no rate is passed in", () => {
    const result = priceBooking(input());

    expect(result.taxFils).toBe(0);
    expect(result.lines.some((line) => line.kind === "tax")).toBe(false);
  });

  it("takes an inclusive rate out of the total instead of adding it on", () => {
    const result = priceBooking(
      input({ tax: { percent: 5, inclusive: true, label: "VAT" } }),
    );

    expect(result.totalFils).toBe(66_000);
    expect(result.taxFils).toBe(3_143);
    expect(result.lines.find((line) => line.kind === "tax")?.isIncluded).toBe(true);
  });

  it("still supports an exclusive rate, should the treatment ever change", () => {
    const result = priceBooking(
      input({ tax: { percent: 5, inclusive: false, label: "VAT" } }),
    );

    expect(result.taxFils).toBe(3_300);
    expect(result.totalFils).toBe(69_300);
    expect(result.taxIsIncluded).toBe(false);
  });

  it("Q-20 — the service fee sits outside the VAT-inclusive price [ASSUMED]", () => {
    const result = priceBooking(
      input({
        serviceFee: { enabled: true, percent: 6, label: "Service Fee" },
        tax: { percent: 5, inclusive: true, label: "VAT" },
      }),
    );

    expect(result.taxFils).toBe(taxWithin(result.orderValueFils, 5));
    expect(result.totalFils).toBe(result.orderValueFils + result.serviceFeeFils);
  });
});

describe("money stays integer fils", () => {
  it("rounds a percentage to whole fils", () => {
    expect(percentOfFils(3_333, 6)).toBe(200);
    expect(Number.isInteger(percentOfFils(3_333, 6))).toBe(true);
  });

  it("returns zero for a non-positive or non-finite percentage", () => {
    expect(percentOfFils(10_000, 0)).toBe(0);
    expect(percentOfFils(10_000, -5)).toBe(0);
    expect(percentOfFils(10_000, Number.NaN)).toBe(0);
  });

  it("keeps every amount in a breakdown an integer", () => {
    const result = priceBooking(
      input({
        guests: { adults: 2, childAges: [9] },
        addons: [addon({ quantity: 2 })],
        promotion: { code: "ODD", kind: "percent", amountFils: null, percent: 7.5 },
        serviceFee: { enabled: true, percent: 6, label: "Service Fee" },
        tax: { percent: 5, inclusive: true, label: "VAT" },
      }),
    );

    for (const line of result.lines) {
      expect(Number.isInteger(line.amountFils)).toBe(true);
    }
    expect(Number.isInteger(result.totalFils)).toBe(true);
    expect(Number.isInteger(result.taxFils)).toBe(true);
    expect(Number.isInteger(result.netFils)).toBe(true);
  });
});
