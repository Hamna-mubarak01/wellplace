import { z } from "zod";
import { CHECKOUT_FLOW } from "@/lib/config/checkout-flow";

import {
  QUOTE_UNAVAILABLE,
  type GuestQuoteResult,
} from "@/app/(site)/book/quote-types";
import type { BookingAddonCard } from "@/components/booking/booking-types";
import { getSetting, requireSetting, type SettingsSnapshot } from "@/lib/config";
import { listPublicAddons, type AddonCatalogueItem } from "@/lib/db/queries/pricing";
import type { WellPlaceClient } from "@/lib/db/types";
import { quoteBooking } from "@/lib/services/pricing-service";
import { guestBookingRefusal } from "@/lib/services/guest-booking-rules";

export const guestQuoteSchema = z.object({
  voucherCode: z.string().trim().toUpperCase().max(CHECKOUT_FLOW.codeLength).optional(),
  paymentOption: z.enum(["card", "tabby"]).default("card"),
  dateOfBirth: z.iso.date().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  durationHours: z.number().int().positive().max(24),
  adults: z.number().int().nonnegative().max(64),
  childAges: z.array(z.number().int().nonnegative().max(120)).max(64),
  addonQuantities: z.record(z.uuid(), z.number().int().nonnegative().max(999)),
  comparisonDurationsHours: z.array(z.number().int().positive().max(24)).max(12),
});

export type GuestQuoteInput = z.input<typeof guestQuoteSchema>;

export function toGuestAddonCard(item: AddonCatalogueItem): BookingAddonCard {
  return {
    availabilityMessage: item.availabilityMessage,
    isTaxable: item.isTaxable,
    id: item.id,
    name: item.name,
    description: item.description,
    imagePath: item.imagePath,
    savingLabel: item.savingLabel,
    kind: item.kind,
    isSoldOut: item.isSoldOut,
    regularUnitPriceFils: item.regularUnitPriceFils,
    offerUnitPriceFils: item.offerUnitPriceFils,
    defaultQuantity: item.defaultQuantity,
    minQuantity: item.minQuantity,
    maxQuantity: item.maxQuantity,
    isLocked: item.isLocked,
  };
}

function withoutSoldOut(
  quantities: Readonly<Record<string, number>>,
  catalogue: readonly AddonCatalogueItem[],
): Record<string, number> {
  const chosen: Record<string, number> = { ...quantities };
  for (const item of catalogue) {
    if (item.isSoldOut) chosen[item.id] = 0;
  }
  return chosen;
}

export async function priceGuestBooking(
  client: WellPlaceClient,
  settings: SettingsSnapshot,
  request: GuestQuoteInput,
  resolvedVoucher?: import("@/lib/domain/vouchers").Voucher | null,
): Promise<GuestQuoteResult> {
  try {
    const refusal = guestBookingRefusal(settings, request);
    if (refusal) return { status: "unpriced", message: refusal };
    const catalogue = await listPublicAddons(client);

    const quote = await quoteBooking(
      client,
      settings,
      {
        startsAt: request.startsAt,
        durationHours: request.durationHours,
        adults: request.adults,
        childAges: request.childAges,
        addonQuantities: withoutSoldOut(request.addonQuantities, catalogue),
        voucherCode: request.voucherCode || null,
        customerId: null,
        manualTotalFils: null,
        comparisonDurationsHours: request.comparisonDurationsHours.filter((hours) => requireSetting(settings, "booking.durations_hours").includes(hours)),
      },
      { resolvedVoucher, audience: "guest", includeServiceFee: request.paymentOption === "tabby" },
    );

    if (quote.breakdown.outcome !== "priced") return { status: "unpriced", message: "A price is not available for this visit yet. Please choose another time or contact WellPlace." };
    return {
      status: "priced",
      quote: {
        cartVoucher: quote.voucher?.kind === "addon_free" ? { code: quote.voucher.code, kind: quote.voucher.kind, targetAddonIds: quote.voucher.targetAddonIds } : null,
        voucherMessage: quote.voucherMessage,
        breakdown: quote.breakdown,
        cart: quote.cart,
        addons: quote.catalogue.map(toGuestAddonCard),
        durationTotals: quote.durationTotals,
        offerLabel: quote.offerLabel,
        taxLabel: requireSetting(settings, "tax.label"),
        taxPercent: getSetting(settings, "tax.vat_percent"),
      },
    };
  } catch (cause) {
    console.error("[booking] priceGuestBooking fault:", cause);
    return { status: "unpriced", message: QUOTE_UNAVAILABLE };
  }
}
