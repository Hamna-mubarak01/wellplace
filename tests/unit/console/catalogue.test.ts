import { describe, expect, it } from "vitest";
import { NEW_PRICE, NEW_ADDON, priceEditorSchema, addonEditorSchema } from "@/lib/config/catalogue";
import { buildCart } from "@/lib/domain/vouchers";
import { priceBooking } from "@/lib/domain/pricing";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";

describe("[CLIENT pricing specification §7–8] catalogue controls", () => {
  it("refuses reversed dates, ambiguous discounts and invalid quantities", () => {
    expect(priceEditorSchema.safeParse({ ...NEW_PRICE, season_from: "2026-09-20", season_to: "2026-09-10" }).success).toBe(false);
    expect(priceEditorSchema.safeParse({ ...NEW_PRICE, offer_percent: 20 }).success).toBe(false);
    expect(addonEditorSchema.safeParse({ ...NEW_ADDON, name: "Towel", min_quantity: 2, default_quantity: 1 }).success).toBe(false);
    expect(priceEditorSchema.safeParse({ ...NEW_PRICE, start_from_minutes: 600, start_to_minutes: null }).success).toBe(false);
  });
  it("keeps included locked items and removes sold-out items from calculations", () => {
    const addon = { id: "towel", name: "Towel", regularUnitPriceFils: 2500, offerUnitPriceFils: 0, defaultQuantity: 1, minQuantity: 1, maxQuantity: 3, isLocked: true };
    expect(buildCart([addon], { towel: 0 }, null)[0].quantity).toBe(1);
    expect(buildCart([{ ...addon, isSoldOut: true }], {}, null)).toEqual([]);
    expect(buildCart([{ ...addon, isLocked: false }], { towel: 0 }, null)).toEqual([]);
  });
  it("applies addon VAT choices to inclusive and exclusive totals", () => {
    const input = { context: { isoDate: "2026-09-10", weekday: 4, startMinutes: 600, durationHours: 2 }, tiers: LAUNCH_PRICE_TIERS,
      guests: { adults: 2, childAges: [] }, addons: [{ id: "item", name: "Item", regularUnitPriceFils: 10500, unitPriceFils: 10500, quantity: 1, isLocked: false, isTaxable: false }],
      promotion: null, serviceFee: null, roundingFils: 50, manualTotalFils: null, tax: { inclusive: true, percent: 5, label: "VAT" } };
    const inclusive = priceBooking(input);
    expect(inclusive.totalFils).toBe(76500);
    expect(inclusive.taxFils).toBe(3143);
    const exclusive = priceBooking({ ...input, tax: { ...input.tax, inclusive: false } });
    expect(exclusive.taxFils).toBe(3300);
    expect(exclusive.totalFils).toBe(79800);
  });
});
