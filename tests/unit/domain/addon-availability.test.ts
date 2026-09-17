import { describe, expect, it } from "vitest";
import { addonAvailabilityMessage } from "@/lib/domain/vouchers/addon-availability";
import { buildCart } from "@/lib/domain/vouchers";
import { addonEditorSchema, NEW_ADDON } from "@/lib/config/catalogue";

const addon = { id: "towel", name: "Towel", regularUnitPriceFils: 3000, offerUnitPriceFils: 0, minQuantity: 1, maxQuantity: 5, defaultQuantity: 3, isLocked: true };
describe("[CLIENT pricing §8] Add-on availability and independent quantities", () => {
  it("allows the boundary values and excludes visits outside either eligibility range", () => {
    const rules = { eligibleMinGuests: 2, eligibleMaxGuests: 4, eligibleMinHours: 3, eligibleMaxHours: 5 };
    expect(addonAvailabilityMessage(rules, 2, 3)).toBeNull();
    expect(addonAvailabilityMessage(rules, 4, 5)).toBeNull();
    for (const [guests, hours] of [[1, 3], [5, 3], [2, 2], [2, 6]]) {
      const availabilityMessage = addonAvailabilityMessage(rules, guests, hours);
      expect(availabilityMessage).not.toBeNull();
      expect(buildCart([{ ...addon, availabilityMessage }], {}, null)).toEqual([]);
    }
  });
  it("lets a locked included item be reduced within its limits, but not removed", () => {
    expect(buildCart([addon], { towel: 2 }, null)[0].quantity).toBe(2);
    expect(buildCart([addon], { towel: 0 }, null)[0].quantity).toBe(3);
    expect(buildCart([addon], { towel: 5 }, null)[0].quantity).toBe(5);
  });
  it("adds a voucher-only item at its default and removes it when the code is removed", () => {
    const paid = { ...addon, offerUnitPriceFils: 2000, isLocked: false };
    const voucher = { code: "TOWEL", kind: "addon_free" as const, targetAddonIds: [addon.id] };
    expect(buildCart([paid], {}, voucher)[0]).toMatchObject({ quantity: 3, unitPriceFils: 0, isIncluded: true });
    expect(buildCart([paid], {}, null)).toEqual([]);
    expect(buildCart([paid], { towel: 2 }, null)[0]).toMatchObject({ quantity: 2, unitPriceFils: 2000 });
  });
  it("validates editable eligibility ranges and unavailable stock", () => {
    expect(addonEditorSchema.safeParse({ ...NEW_ADDON, name: "Towel", eligible_min_hours: 4, eligible_max_hours: 2 }).success).toBe(false);
    expect(addonEditorSchema.safeParse({ ...NEW_ADDON, name: "Towel", min_quantity: 2, default_quantity: 2, max_quantity: 5, inventory: 1 }).success).toBe(false);
    expect(addonEditorSchema.safeParse({ ...NEW_ADDON, name: "Towel", inventory: 0 }).success).toBe(true);
  });
});
