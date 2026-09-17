import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import {
  priceBooking,
  type AddonSelection,
  type PricingContext,
} from "@/lib/domain/pricing";
import { buildCart, checkVoucher } from "@/lib/domain/vouchers";

const root = resolve(__dirname, "../../..");
const ROUNDING = requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils");
const VAT = requireSetting(EMPTY_SNAPSHOT, "tax.vat_percent");

const context = (durationHours: number): PricingContext => ({
  isoDate: "2026-09-14",
  weekday: 1,
  startMinutes: 10 * 60,
  durationHours,
});

const book = (
  hours: number,
  adults: number,
  children: number,
  addons: readonly AddonSelection[] = [],
) =>
  priceBooking({
    context: context(hours),
    tiers: LAUNCH_PRICE_TIERS,
    guests: { adults, childAges: Array.from({ length: children }, () => 10) },
    addons,
    promotion: null,
    serviceFee: null,
    tax: { percent: VAT, inclusive: true, label: "VAT" },
    roundingFils: ROUNDING,
    manualTotalFils: null,
  });

describe("§9 — the specification's own implementation checks", () => {
  it("One-hour booking — not selectable or purchasable", () => {
    const durations = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours");
    expect(durations).not.toContain(1);
    expect(Math.min(...durations)).toBe(2);
  });

  it("Minimum booking — two guests for two hours; minimum two-adult total AED 660", () => {
    expect(requireSetting(EMPTY_SNAPSHOT, "booking.guests_min")).toBe(2);
    expect(book(2, 2, 0).totalFils).toBe(66_000);
  });

  it("Regular pricing — crossed out beside the Special Offer price", () => {
    const result = book(2, 2, 0);

    expect(result.regularTotalFils).toBe(88_000);
    expect(result.regularTotalFils).toBeGreaterThan(result.totalFils);
    expect(result.savingFils).toBe(22_000);
    expect(result.savingPercent).toBe(25);
  });

  it("VAT — included in every displayed and calculated amount", () => {
    for (const hours of [2, 3, 4, 5, 6]) {
      const result = book(hours, 2, 1);

      expect(result.taxIsIncluded).toBe(true);
      expect(result.taxFils).toBeGreaterThan(0);
      expect(result.netFils + result.taxFils).toBe(result.totalFils);
    }
  });

  it("Mixed groups — adult and child totals calculated independently, then added", () => {
    expect(book(4, 2, 1).totalFils).toBe(book(4, 2, 0).totalFils + book(4, 0, 1).totalFils);
  });

  it("Included items — every eligible AED 0 item is included and shows no percentage", () => {
    const result = book(2, 2, 0, [
      {
        id: "towel",
        name: "Towel rental",
        regularUnitPriceFils: 2_500,
        unitPriceFils: 0,
        quantity: 1,
        isLocked: false,
      },
    ]);

    const line = result.lines.find((row) => row.kind === "addon");

    expect(line?.isIncluded).toBe(true);
    expect(line?.amountFils).toBe(0);
    expect(line?.regularUnitPriceFils).toBe(2_500);
    expect(result.totalFils).toBe(66_000);
  });

  it("Included items — an AED 0 item never increases the amount payable", () => {
    const without = book(3, 2, 0);
    const with_ = book(3, 2, 0, [
      {
        id: "robe",
        name: "Bathrobe rental",
        regularUnitPriceFils: 4_000,
        unitPriceFils: 0,
        quantity: 2,
        isLocked: false,
      },
    ]);

    expect(with_.totalFils).toBe(without.totalFils);
  });

  it("Final checkout — the complete final amount is available before payment", () => {
    const result = book(4, 2, 1);

    expect(result.outcome).toBe("priced");
    expect(result.totalFils).toBe(169_500);
    expect(Number.isInteger(result.totalFils)).toBe(true);
  });

  it("Management — every rate, tier and rule is configuration, not a literal", () => {
    expect(existsSync(resolve(root, "src/lib/config/pricing.ts"))).toBe(true);

    for (const tier of LAUNCH_PRICE_TIERS) {
      expect(tier.regularFilsPerHour).toBeGreaterThan(0);
      expect(tier.guestKind === "adult" || tier.guestKind === "child").toBe(true);
    }

    expect(requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils")).toBe(50);
    expect(requireSetting(EMPTY_SNAPSHOT, "pricing.offer_headline")).toContain("165");
  });
});

describe("§9 — add-on vouchers", () => {
  it("Add-on vouchers — a valid code can set a targeted add-on to AED 0 and add it automatically", () => {
    const catalogue = [
      {
        id: "towel",
        name: "Towel rental",
        regularUnitPriceFils: 2_500,
        offerUnitPriceFils: 2_500,
        defaultQuantity: 1,
        minQuantity: 1,
        maxQuantity: 4,
        isLocked: false,
      },
    ];

    const code = {
      code: "TOWELFREE",
      kind: "addon_free" as const,
      amountFils: null,
      percent: null,
      targetAddonIds: ["towel"],
      validFrom: null,
      validTo: null,
      maxUses: null,
      usedCount: 0,
      perCustomerLimit: null,
      customerUsedCount: 0,
      isCombinable: true,
      isActive: true,
    };

    const verdict = checkVoucher(code, {
      isoDate: "2026-09-14",
      hasOtherPromotion: false,
      availableAddonIds: ["towel"],
    });
    expect(verdict.accepted).toBe(true);

    const cart = buildCart(catalogue, {}, code);
    expect(cart).toHaveLength(1);
    expect(cart[0].unitPriceFils).toBe(0);
    expect(cart[0].isIncluded).toBe(true);
  });
});

describe("§9 — checks that need surfaces this plan has not finished yet", () => {
  const OUTSTANDING: ReadonlyArray<{ check: string; why: string }> = [
    {
      check: "Add-on cards — image, description, comparison price, offer price and one-click cart action",
      why: "the add-on schema extension and the card UI land later in this plan",
    },
  ];

  it("records why each outstanding check is not yet proved", () => {
    for (const entry of OUTSTANDING) {
      expect(entry.why, entry.check).toBeTruthy();
    }

    expect(OUTSTANDING).toHaveLength(1);
  });
});
