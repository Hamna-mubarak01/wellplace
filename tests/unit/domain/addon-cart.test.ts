import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import { priceBooking, type PricingContext } from "@/lib/domain/pricing";
import { buildCart, type CartAddon, type CartLine } from "@/lib/domain/vouchers";

const ROUNDING = requireSetting(EMPTY_SNAPSHOT, "pricing.rounding_fils");
const VAT = requireSetting(EMPTY_SNAPSHOT, "tax.vat_percent");
const GUESTS_MIN = requireSetting(EMPTY_SNAPSHOT, "booking.guests_min");
const GUESTS_MAX = requireSetting(EMPTY_SNAPSHOT, "booking.guests_max");

const CONTEXT: PricingContext = {
  isoDate: "2026-09-14",
  weekday: 1,
  startMinutes: 10 * 60,
  durationHours: 2,
};

const TOWEL: CartAddon = {
  id: "towel",
  name: "Towel",
  regularUnitPriceFils: 2_500,
  offerUnitPriceFils: 0,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 5,
  isLocked: false,
};

const ROBE: CartAddon = {
  id: "robe",
  name: "Bathrobe",
  regularUnitPriceFils: 4_000,
  offerUnitPriceFils: 4_000,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 5,
  isLocked: false,
};

const CATALOGUE = [TOWEL, ROBE] as const;

function priceWith(cart: readonly CartLine[], adults: number, childAges: readonly number[]) {
  return priceBooking({
    context: CONTEXT,
    tiers: LAUNCH_PRICE_TIERS,
    guests: { adults, childAges },
    addons: cart.map((line) => ({
      id: line.id,
      name: line.name,
      regularUnitPriceFils: line.regularUnitPriceFils,
      unitPriceFils: line.unitPriceFils,
      quantity: line.quantity,
      isLocked: line.isLocked,
    })),
    promotion: null,
    serviceFee: { enabled: true, percent: 6, label: "Service Fee" },
    tax: { percent: VAT, inclusive: true, label: "VAT" },
    roundingFils: ROUNDING,
    manualTotalFils: null,
  });
}

const addonLinesOf = (breakdown: ReturnType<typeof priceWith>) =>
  breakdown.lines
    .filter((line) => line.kind === "addon")
    .map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPriceFils: line.unitPriceFils,
      amountFils: line.amountFils,
      isIncluded: line.isIncluded,
    }));

describe("pricing specification §8 — an AED 0 add-on is included automatically, at its default quantity", () => {
  it("appears in the cart without being asked for, and prices to nothing", () => {
    const cart = buildCart(CATALOGUE, {}, null);
    const breakdown = priceWith(cart, GUESTS_MIN, []);

    const towel = addonLinesOf(breakdown).find((line) => line.id === "addon:towel");

    expect(towel).toBeDefined();
    expect(towel?.quantity).toBe(TOWEL.defaultQuantity);
    expect(towel?.unitPriceFils).toBe(0);
    expect(towel?.amountFils).toBe(0);
    expect(towel?.isIncluded).toBe(true);
  });

  it("adds nothing to the order value, and therefore nothing to the service fee [§8.1, INV-19]", () => {
    const withIncluded = priceWith(buildCart(CATALOGUE, {}, null), GUESTS_MIN, []);
    const withoutAny = priceWith([], GUESTS_MIN, []);

    expect(withIncluded.addonsTotalFils).toBe(0);
    expect(withIncluded.orderValueFils).toBe(withoutAny.orderValueFils);
    expect(withIncluded.serviceFeeFils).toBe(withoutAny.serviceFeeFils);
    expect(withIncluded.totalFils).toBe(withoutAny.totalFils);
  });

  it("keeps its regular price visible so the guest can see what it is worth", () => {
    const cart = buildCart(CATALOGUE, {}, null);
    const towel = cart.find((line) => line.id === "towel");

    expect(towel?.regularUnitPriceFils).toBe(TOWEL.regularUnitPriceFils);
    expect(towel?.unitPriceFils).toBe(0);
  });

  it("leaves a paid add-on out until it is asked for", () => {
    expect(buildCart(CATALOGUE, {}, null).map((line) => line.id)).toEqual(["towel"]);
    expect(buildCart(CATALOGUE, { robe: 1 }, null).map((line) => line.id)).toEqual([
      "towel",
      "robe",
    ]);
  });
});

describe("pricing specification §8 — changing the guest count never changes an add-on quantity", () => {
  const CHOSEN = { towel: 3, robe: 2 };

  const guestShapes = [
    { label: `${GUESTS_MIN} adults`, adults: GUESTS_MIN, childAges: [] as number[] },
    { label: "3 adults", adults: 3, childAges: [] as number[] },
    { label: "2 adults and 2 children", adults: 2, childAges: [10, 14] },
    { label: `${GUESTS_MAX} guests`, adults: GUESTS_MAX, childAges: [] as number[] },
  ];

  const baseline = priceWith(buildCart(CATALOGUE, CHOSEN, null), GUESTS_MIN, []);

  for (const shape of guestShapes) {
    it(`prices the same add-on lines for ${shape.label}`, () => {
      const breakdown = priceWith(
        buildCart(CATALOGUE, CHOSEN, null),
        shape.adults,
        shape.childAges,
      );

      expect(addonLinesOf(breakdown)).toEqual(addonLinesOf(baseline));
      expect(breakdown.addonsTotalFils).toBe(baseline.addonsTotalFils);
    });
  }

  it("still charges more for more guests, so the comparison above is not vacuous", () => {
    const two = priceWith(buildCart(CATALOGUE, CHOSEN, null), 2, []);
    const five = priceWith(buildCart(CATALOGUE, CHOSEN, null), 5, []);

    expect(five.subtotalFils).toBeGreaterThan(two.subtotalFils);
    expect(five.totalFils).toBeGreaterThan(two.totalFils);
  });

  it("charges an add-on per unit ordered, never once per guest", () => {
    const one = priceWith(buildCart(CATALOGUE, { robe: 1 }, null), 5, []);
    const two = priceWith(buildCart(CATALOGUE, { robe: 2 }, null), 2, []);

    expect(one.addonsTotalFils).toBe(ROBE.offerUnitPriceFils);
    expect(two.addonsTotalFils).toBe(ROBE.offerUnitPriceFils * 2);
  });

  it("takes the quantity from the guest's own choice and clamps it to the add-on, never to the party size", () => {
    const fiveTowelsForTwoGuests = priceWith(
      buildCart(CATALOGUE, { towel: 5 }, null),
      2,
      [],
    );
    const oneTowelForFiveGuests = priceWith(
      buildCart(CATALOGUE, { towel: 1 }, null),
      5,
      [],
    );

    expect(
      addonLinesOf(fiveTowelsForTwoGuests).find((line) => line.id === "addon:towel")
        ?.quantity,
    ).toBe(5);
    expect(
      addonLinesOf(oneTowelForFiveGuests).find((line) => line.id === "addon:towel")
        ?.quantity,
    ).toBe(1);
    expect(buildCart(CATALOGUE, { towel: 9 }, null)[0].quantity).toBe(TOWEL.maxQuantity);
  });
});
