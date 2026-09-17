import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import { COUPON_PREVIEW, type CouponPreviewRequest } from "@/lib/config/coupons";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Voucher } from "@/lib/domain/vouchers";
import { todayInDubai } from "@/lib/domain/time";
import { quoteBooking, type QuoteRequest } from "@/lib/services/pricing-service";

const PREVIEW_CODE = "PREVIEW";

export interface CouponIncomeFigures {
  readonly totalFils: number;
  readonly netFils: number;
}

export interface CouponIncomePreview {
  readonly adults: number;
  readonly durationHours: number;
  readonly freeAddonNames: readonly string[];
  readonly withoutCoupon: CouponIncomeFigures;
  readonly withCoupon: CouponIncomeFigures;
  readonly discountFils: number;
  readonly uses: number;
  readonly usesWithoutCouponFils: number;
  readonly usesWithCouponFils: number;
  readonly usesDiscountFils: number;
}

export type CouponPreviewResult =
  | { readonly ok: true; readonly preview: CouponIncomePreview }
  | { readonly ok: false; readonly message: string };

export function previewVoucher(request: CouponPreviewRequest): Voucher {
  return {
    code: PREVIEW_CODE,
    kind: request.kind,
    amountFils: request.kind === "fixed" ? request.amountFils : null,
    percent: request.kind === "percent" ? request.percent : null,
    targetAddonIds: request.kind === "addon_free" ? request.addonIds : [],
    validFrom: null,
    validTo: null,
    maxUses: null,
    usedCount: 0,
    perCustomerLimit: null,
    customerUsedCount: 0,
    isCombinable: true,
    isActive: true,
  };
}

export function referenceStart(now: Date): string {
  return `${todayInDubai(now)}T${COUPON_PREVIEW.startTime}:00${COUPON_PREVIEW.dubaiOffset}`;
}

export function referenceBooking(
  snapshot: SettingsSnapshot,
  request: CouponPreviewRequest,
  startsAt: string,
): QuoteRequest {
  const addonQuantities: Record<string, number> = {};
  if (request.kind === "addon_free") for (const id of request.addonIds) addonQuantities[id] = 1;

  return {
    startsAt,
    durationHours: Math.min(...requireSetting(snapshot, "booking.durations_hours")),
    adults: requireSetting(snapshot, "booking.guests_min"),
    childAges: [],
    addonQuantities,
    voucherCode: null,
    customerId: null,
    manualTotalFils: null,
  };
}

export async function previewCouponIncome(
  client: WellPlaceClient,
  request: CouponPreviewRequest,
  now: Date = new Date(),
): Promise<CouponPreviewResult> {
  try {
    const snapshot = await loadSettingsSnapshot(client);
    const booking = referenceBooking(snapshot, request, referenceStart(now));

    const [baseline, discounted] = await Promise.all([
      quoteBooking(client, snapshot, booking, { audience: "staff" }),
      quoteBooking(
        client,
        snapshot,
        { ...booking, voucherCode: PREVIEW_CODE },
        { audience: "staff", resolvedVoucher: previewVoucher(request) },
      ),
    ]);

    if (baseline.breakdown.outcome !== "priced" || discounted.breakdown.outcome !== "priced") {
      return {
        ok: false,
        message: "No active rate covers the smallest booking right now, so the expected income cannot be shown.",
      };
    }

    if (discounted.voucher === null) {
      return {
        ok: false,
        message:
          request.kind === "addon_free"
            ? "None of the selected add-ons can be added to the smallest booking right now, so this coupon would not change what a guest pays."
            : "This discount cannot be applied to the smallest booking right now.",
      };
    }

    const freeAddonNames = discounted.cart
      .filter((line) => line.voucherCode === PREVIEW_CODE)
      .map((line) => line.name);

    const withoutCoupon = { totalFils: baseline.breakdown.totalFils, netFils: baseline.breakdown.netFils };
    const withCoupon = { totalFils: discounted.breakdown.totalFils, netFils: discounted.breakdown.netFils };
    const discountFils = Math.max(0, withoutCoupon.totalFils - withCoupon.totalFils);

    return {
      ok: true,
      preview: {
        adults: booking.adults,
        durationHours: booking.durationHours,
        freeAddonNames,
        withoutCoupon,
        withCoupon,
        discountFils,
        uses: request.uses,
        usesWithoutCouponFils: withoutCoupon.totalFils * request.uses,
        usesWithCouponFils: withCoupon.totalFils * request.uses,
        usesDiscountFils: discountFils * request.uses,
      },
    };
  } catch (cause) {
    console.error("[coupons] income preview failed", cause);
    return { ok: false, message: "The expected income could not be calculated. Try again." };
  }
}
