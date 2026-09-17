import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS, type SettingsSnapshot } from "@/lib/config";
import type { CouponPreviewRequest } from "@/lib/config/coupons";
import type { StaffAddonCatalogueItem } from "@/lib/db/queries/pricing";
import type { WellPlaceClient } from "@/lib/db/types";
import type { PriceTier } from "@/lib/domain/pricing";

const state = vi.hoisted(() => ({
  tiers: [] as PriceTier[],
  addons: [] as StaffAddonCatalogueItem[],
  tiersFail: false,
}));

vi.mock("@/lib/db/queries/pricing", () => ({
  listPriceTiers: vi.fn(async () => (state.tiersFail ? { ok: false, message: "down" } : { ok: true, tiers: state.tiers })),
  listAddonCatalogue: vi.fn(async () => ({ ok: true, addons: state.addons })),
  listPublicPriceTiers: vi.fn(async () => state.tiers),
  listPublicAddons: vi.fn(async () => state.addons),
  findVoucher: vi.fn(async () => null),
}));

const settings: SettingsSnapshot = Object.fromEntries(
  Object.entries(SETTINGS).map(([key, setting]) => [key, setting.defaultValue]),
);

vi.mock("@/lib/db/queries/settings", () => ({ loadSettingsSnapshot: vi.fn(async () => settings) }));

import { previewCouponIncome } from "@/lib/services/coupon-preview-service";

const client = {} as WellPlaceClient;
const now = new Date("2026-09-12T08:00:00Z");

const adultTier: PriceTier = {
  id: "adult",
  guestKind: "adult",
  fromHour: 1,
  toHour: null,
  regularFilsPerHour: 22_000,
  offerFilsPerHour: 16_500,
  offerPercent: null,
  weekdays: null,
  seasonFrom: null,
  seasonTo: null,
  startWindow: null,
  priority: 0,
};

const robe = (over: Partial<StaffAddonCatalogueItem> = {}): StaffAddonCatalogueItem => ({
  id: "0b8f7a52-6f11-4d0e-9a34-5d6f3c2b1a01",
  name: "Bathrobe",
  regularUnitPriceFils: 4_000,
  offerUnitPriceFils: 3_000,
  defaultQuantity: 0,
  minQuantity: 0,
  maxQuantity: 5,
  isLocked: false,
  eligibleMinGuests: null,
  eligibleMaxGuests: null,
  eligibleMinHours: null,
  eligibleMaxHours: null,
  isTaxable: true,
  description: null,
  imagePath: null,
  savingLabel: null,
  kind: "extra",
  isSoldOut: false,
  receptionNote: null,
  ...over,
});

const request = (over: Partial<CouponPreviewRequest>): CouponPreviewRequest => ({
  kind: "percent",
  amountFils: null,
  percent: null,
  addonIds: [],
  uses: 1,
  ...over,
});

const netOf = (grossFils: number) => Math.round(grossFils / 1.05);

beforeEach(() => {
  state.tiers = [adultTier];
  state.addons = [];
  state.tiersFail = false;
});

describe("[CLIENT coupon request 2026-09-12] the expected income of a coupon is priced by the checkout engine", () => {
  it("compares the smallest booking with and without a percentage coupon, and projects it over the uses", async () => {
    const result = await previewCouponIncome(client, request({ percent: 10, uses: 50 }), now);
    if (!result.ok) throw new Error(result.message);

    expect(result.preview.adults).toBe(2);
    expect(result.preview.durationHours).toBe(2);
    expect(result.preview.withoutCoupon).toEqual({ totalFils: 66_000, netFils: netOf(66_000) });
    expect(result.preview.withCoupon).toEqual({ totalFils: 59_400, netFils: netOf(59_400) });
    expect(result.preview.discountFils).toBe(6_600);
    expect(result.preview.usesWithCouponFils).toBe(59_400 * 50);
    expect(result.preview.usesDiscountFils).toBe(6_600 * 50);
    expect(result.preview.usesWithoutCouponFils).toBe(66_000 * 50);
  });

  it("takes a fixed amount off the visit, never below zero", async () => {
    const fixed = await previewCouponIncome(client, request({ kind: "fixed", amountFils: 10_000 }), now);
    const huge = await previewCouponIncome(client, request({ kind: "fixed", amountFils: 1_000_000 }), now);
    if (!fixed.ok || !huge.ok) throw new Error("not priced");

    expect(fixed.preview.withCoupon.totalFils).toBe(56_000);
    expect(huge.preview.withCoupon.totalFils).toBe(0);
    expect(huge.preview.discountFils).toBe(66_000);
  });

  it("prices a free add-on coupon as the add-on given away, and names it", async () => {
    state.addons = [robe()];

    const result = await previewCouponIncome(client, request({ kind: "addon_free", addonIds: [robe().id] }), now);
    if (!result.ok) throw new Error(result.message);

    expect(result.preview.withoutCoupon.totalFils).toBe(69_000);
    expect(result.preview.withCoupon.totalFils).toBe(66_000);
    expect(result.preview.discountFils).toBe(3_000);
    expect(result.preview.freeAddonNames).toEqual(["Bathrobe"]);
  });

  it("says so when none of the chosen add-ons can be added to the smallest booking", async () => {
    state.addons = [robe({ isSoldOut: true })];

    const result = await previewCouponIncome(client, request({ kind: "addon_free", addonIds: [robe().id] }), now);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("add-ons");
  });

  it("shows no figure rather than a wrong one when no rate covers the smallest booking", async () => {
    state.tiers = [];

    const result = await previewCouponIncome(client, request({ percent: 10 }), now);

    expect(result.ok).toBe(false);
  });

  it("reports a failed price read instead of throwing", async () => {
    state.tiersFail = true;

    const result = await previewCouponIncome(client, request({ percent: 10 }), now);

    expect(result).toEqual({ ok: false, message: "The expected income could not be calculated. Try again." });
  });
});
