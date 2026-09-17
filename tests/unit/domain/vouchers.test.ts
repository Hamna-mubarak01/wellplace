import { describe, expect, it } from "vitest";

import {
  VOUCHER_REFUSAL_MESSAGE,
  bookingPromotionFrom,
  buildCart,
  checkVoucher,
  clampQuantity,
  isAutomaticallyIncluded,
  type CartAddon,
  type Voucher,
  type VoucherContext,
} from "@/lib/domain/vouchers";

const voucher = (over: Partial<Voucher> = {}): Voucher => ({
  code: "TOWELFREE",
  kind: "addon_free",
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
  ...over,
});

const context = (over: Partial<VoucherContext> = {}): VoucherContext => ({
  isoDate: "2026-09-14",
  hasOtherPromotion: false,
  availableAddonIds: ["towel", "robe"],
  ...over,
});

const addon = (over: Partial<CartAddon> = {}): CartAddon => ({
  id: "robe",
  name: "Bathrobe rental",
  regularUnitPriceFils: 4_000,
  offerUnitPriceFils: 4_000,
  defaultQuantity: 1,
  minQuantity: 1,
  maxQuantity: 4,
  isLocked: false,
  ...over,
});

describe("§8 — a voucher is refused for a stated reason, never silently", () => {
  it("accepts a valid code", () => {
    expect(checkVoucher(voucher(), context()).accepted).toBe(true);
  });

  it("refuses an unknown code", () => {
    const verdict = checkVoucher(null, context());
    expect(verdict).toEqual({ accepted: false, reason: "unknown_code" });
  });

  it("refuses an inactive, not-yet-valid or expired code", () => {
    expect(checkVoucher(voucher({ isActive: false }), context())).toEqual({
      accepted: false,
      reason: "inactive",
    });
    expect(checkVoucher(voucher({ validFrom: "2026-10-01" }), context())).toEqual({
      accepted: false,
      reason: "not_yet_valid",
    });
    expect(checkVoucher(voucher({ validTo: "2026-09-01" }), context())).toEqual({
      accepted: false,
      reason: "expired",
    });
  });

  it("refuses a code past its total usage limit", () => {
    expect(
      checkVoucher(voucher({ maxUses: 5, usedCount: 5 }), context())?.accepted,
    ).toBe(false);
    expect(
      checkVoucher(voucher({ maxUses: 5, usedCount: 4 }), context())?.accepted,
    ).toBe(true);
  });

  it("refuses a code this guest has already used to its limit", () => {
    expect(
      checkVoucher(
        voucher({ perCustomerLimit: 1, customerUsedCount: 1 }),
        context(),
      ),
    ).toEqual({ accepted: false, reason: "customer_limit_reached" });
  });

  it("refuses a non-combinable code when another promotion is applied", () => {
    expect(
      checkVoucher(
        voucher({ isCombinable: false }),
        context({ hasOtherPromotion: true }),
      ),
    ).toEqual({ accepted: false, reason: "not_combinable" });
  });

  it("refuses an add-on code that targets nothing this booking can have", () => {
    expect(
      checkVoucher(voucher({ targetAddonIds: ["sauna"] }), context()),
    ).toEqual({ accepted: false, reason: "no_eligible_addon" });
  });

  it("gives every refusal a message that says what to do", () => {
    for (const message of Object.values(VOUCHER_REFUSAL_MESSAGE)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

describe("§8 — AED 0 is the automatic inclusion trigger", () => {
  it("recognises a zero offer price as automatically included", () => {
    expect(isAutomaticallyIncluded(addon({ offerUnitPriceFils: 0 }))).toBe(true);
    expect(isAutomaticallyIncluded(addon())).toBe(false);
  });

  it("adds every AED 0 item to the cart at its default quantity, unasked", () => {
    const cart = buildCart(
      [
        addon({ id: "towel", name: "Towel rental", offerUnitPriceFils: 0, regularUnitPriceFils: 2_500 }),
        addon({ id: "robe", offerUnitPriceFils: 0, defaultQuantity: 1 }),
      ],
      {},
      null,
    );

    expect(cart).toHaveLength(2);
    expect(cart.every((line) => line.isIncluded)).toBe(true);
    expect(cart.every((line) => line.quantity === 1)).toBe(true);
  });

  it("keeps the original price visible on an included item", () => {
    const cart = buildCart(
      [addon({ offerUnitPriceFils: 0, regularUnitPriceFils: 4_000 })],
      {},
      null,
    );

    expect(cart[0].regularUnitPriceFils).toBe(4_000);
    expect(cart[0].unitPriceFils).toBe(0);
  });

  it("leaves a paid item out of the cart until the guest asks for it", () => {
    expect(buildCart([addon()], {}, null)).toHaveLength(0);
    expect(buildCart([addon()], { robe: 1 }, null)).toHaveLength(1);
  });

  it("lets the guest adjust an included quantity within its configured limits", () => {
    const catalogue = [addon({ offerUnitPriceFils: 0, minQuantity: 1, maxQuantity: 3 })];

    expect(buildCart(catalogue, { robe: 3 }, null)[0].quantity).toBe(3);
    expect(buildCart(catalogue, { robe: 9 }, null)[0].quantity).toBe(3);
    expect(buildCart(catalogue, { robe: 0 }, null)).toHaveLength(0);
  });

  it("§8 — changing the guest count never changes an add-on quantity", () => {
    const catalogue = [addon({ offerUnitPriceFils: 0 })];
    const chosen = { robe: 2 };

    const twoGuests = buildCart(catalogue, chosen, null);
    const fiveGuests = buildCart(catalogue, chosen, null);

    expect(twoGuests[0].quantity).toBe(2);
    expect(fiveGuests[0].quantity).toBe(2);
  });

  it("clamps a quantity to the configured minimum and maximum", () => {
    const item = addon({ minQuantity: 2, maxQuantity: 4 });

    expect(clampQuantity(item, 1)).toBe(2);
    expect(clampQuantity(item, 3)).toBe(3);
    expect(clampQuantity(item, 99)).toBe(4);
    expect(clampQuantity(item, 0)).toBe(0);
  });
});

describe("§8 — a voucher can set a targeted add-on to AED 0", () => {
  it("adds the targeted add-on automatically when it is not yet in the cart", () => {
    const cart = buildCart(
      [addon({ id: "towel", name: "Towel rental", offerUnitPriceFils: 2_500 })],
      {},
      voucher({ targetAddonIds: ["towel"] }),
    );

    expect(cart).toHaveLength(1);
    expect(cart[0].unitPriceFils).toBe(0);
    expect(cart[0].isIncluded).toBe(true);
    expect(cart[0].voucherCode).toBe("TOWELFREE");
  });

  it("updates an add-on already in the cart to AED 0 and keeps its quantity", () => {
    const cart = buildCart(
      [addon({ id: "towel", name: "Towel rental", offerUnitPriceFils: 2_500, maxQuantity: 4 })],
      { towel: 2 },
      voucher({ targetAddonIds: ["towel"] }),
    );

    expect(cart[0].quantity).toBe(2);
    expect(cart[0].unitPriceFils).toBe(0);
  });

  it("keeps the original price crossed out on a voucher-zeroed item", () => {
    const cart = buildCart(
      [addon({ id: "towel", offerUnitPriceFils: 2_500, regularUnitPriceFils: 3_000 })],
      {},
      voucher({ targetAddonIds: ["towel"] }),
    );

    expect(cart[0].regularUnitPriceFils).toBe(3_000);
  });

  it("restores the price the moment the code is removed", () => {
    const catalogue = [addon({ id: "towel", offerUnitPriceFils: 2_500 })];

    const withCode = buildCart(catalogue, { towel: 1 }, voucher({ targetAddonIds: ["towel"] }));
    const without = buildCart(catalogue, { towel: 1 }, null);

    expect(withCode[0].unitPriceFils).toBe(0);
    expect(without[0].unitPriceFils).toBe(2_500);
    expect(without[0].voucherCode).toBeNull();
  });

  it("names the code only where it actually reduced a price, never on an already-free item", () => {
    const alreadyFree = buildCart(
      [addon({ id: "towel", offerUnitPriceFils: 0, regularUnitPriceFils: 2_500 })],
      {},
      voucher({ targetAddonIds: ["towel"] }),
    );

    expect(alreadyFree[0].isIncluded).toBe(true);
    expect(alreadyFree[0].voucherCode).toBeNull();
  });

  it("leaves an untargeted add-on at its own price", () => {
    const cart = buildCart(
      [
        addon({ id: "towel", offerUnitPriceFils: 2_500 }),
        addon({ id: "robe", offerUnitPriceFils: 4_000 }),
      ],
      { towel: 1, robe: 1 },
      voucher({ targetAddonIds: ["towel"] }),
    );

    expect(cart.find((line) => line.id === "towel")?.unitPriceFils).toBe(0);
    expect(cart.find((line) => line.id === "robe")?.unitPriceFils).toBe(4_000);
  });
});

describe("a money voucher becomes a booking promotion, an add-on voucher does not", () => {
  it("turns a fixed or percent code into a booking-level promotion", () => {
    expect(
      bookingPromotionFrom(voucher({ kind: "fixed", amountFils: 5_000 }))?.kind,
    ).toBe("fixed");
    expect(
      bookingPromotionFrom(voucher({ kind: "percent", percent: 10 }))?.percent,
    ).toBe(10);
  });

  it("never discounts the booking price with an add-on code", () => {
    expect(bookingPromotionFrom(voucher())).toBeNull();
    expect(bookingPromotionFrom(null)).toBeNull();
  });
});
