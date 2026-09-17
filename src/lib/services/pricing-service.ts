import { addonAvailabilityMessage } from "@/lib/domain/vouchers/addon-availability";
import { getSetting, requireSetting, type SettingsSnapshot } from "@/lib/config";
import {
  findVoucher,
  listAddonCatalogue,
  listPriceTiers,
  listPublicAddons,
  listPublicPriceTiers,
  type AddonCatalogueItem,
} from "@/lib/db/queries/pricing";
import type { WellPlaceClient } from "@/lib/db/types";
import {
  priceBooking,
  type PriceTier,
  type PricedBreakdown,
  type PricingContext,
  type ServiceFeeConfig,
  type TaxConfig,
} from "@/lib/domain/pricing";
import {
  bookingPromotionFrom,
  buildCart,
  checkVoucher,
  VOUCHER_REFUSAL_MESSAGE,
  GUEST_EXPIRED_VOUCHER_MESSAGE,
  type CartLine,
  type Voucher,
} from "@/lib/domain/vouchers";
import { DUBAI_TIME_ZONE } from "@/lib/domain/time";

export interface QuoteRequest {
  readonly startsAt: string;
  readonly durationHours: number;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly addonQuantities: Readonly<Record<string, number>>;
  readonly voucherCode: string | null;
  readonly customerId: string | null;
  readonly manualTotalFils: number | null;
  readonly comparisonDurationsHours?: readonly number[];
}

export interface Quote {
  readonly breakdown: PricedBreakdown;
  readonly cart: readonly CartLine[];
  readonly catalogue: readonly AddonCatalogueItem[];
  readonly voucher: Voucher | null;
  readonly voucherMessage: string | null;
  readonly offerLabel: string;
  readonly currency: string;
  readonly durationTotals: Readonly<Record<number, number>>;
}

export function dubaiContextFor(
  startsAt: string,
  durationHours: number,
): PricingContext {
  const instant = new Date(startsAt);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(instant);

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    isoDate: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: Math.max(0, weekdayNames.indexOf(value("weekday"))),
    startMinutes: Number(value("hour")) * 60 + Number(value("minute")),
    durationHours,
  };
}

function taxFrom(snapshot: SettingsSnapshot): TaxConfig | null {
  const percent = getSetting(snapshot, "tax.vat_percent");
  if (percent === null || percent <= 0) return null;

  return {
    percent,
    inclusive: requireSetting(snapshot, "tax.inclusive"),
    label: requireSetting(snapshot, "tax.label"),
  };
}

function serviceFeeFrom(snapshot: SettingsSnapshot): ServiceFeeConfig | null {
  const enabled = getSetting(snapshot, "fees.tabby.enabled");
  if (enabled !== true) return null;

  return {
    enabled: true,
    percent: requireSetting(snapshot, "fees.tabby.percent"),
    label: requireSetting(snapshot, "fees.tabby.label"),
  };
}

async function staffCatalogue(
  client: WellPlaceClient,
): Promise<AddonCatalogueItem[]> {
  const listing = await listAddonCatalogue(client);

  if (!listing.ok) {
    throw new Error(
      `The add-on catalogue could not be read, so nothing can be priced against it: ${listing.message}`,
    );
  }

  return listing.addons;
}

async function staffTiers(client: WellPlaceClient): Promise<PriceTier[]> {
  const listing = await listPriceTiers(client);

  if (!listing.ok) {
    throw new Error(
      `The price rules could not be read, so no booking can be priced: ${listing.message}`,
    );
  }

  return listing.tiers;
}

export async function quoteBooking(
  client: WellPlaceClient,
  snapshot: SettingsSnapshot,
  request: QuoteRequest,
  options: {
    readonly includeServiceFee?: boolean;
    readonly audience?: "staff" | "guest";
    readonly resolvedVoucher?: Voucher | null;
  } = {},
): Promise<Quote> {
  const guest = options.audience === "guest";

  const [tiers, items] = await Promise.all([
    guest ? listPublicPriceTiers(client) : staffTiers(client),
    guest ? listPublicAddons(client) : staffCatalogue(client),
  ]);

  const catalogue = items.map((item) => ({ ...item, availabilityMessage: addonAvailabilityMessage(item, request.adults + request.childAges.length, request.durationHours) }));
  const context = dubaiContextFor(request.startsAt, request.durationHours);

  let voucher: Voucher | null = null;
  let voucherMessage: string | null = null;

  if (request.voucherCode !== null && request.voucherCode.trim().length > 0) {
    const found = options.resolvedVoucher !== undefined ? options.resolvedVoucher : await findVoucher(client, request.voucherCode, request.customerId);

    const verdict = checkVoucher(found, {
      isoDate: dubaiContextFor(new Date().toISOString(), request.durationHours).isoDate,
      hasOtherPromotion: false,
      availableAddonIds: catalogue.filter((item) => !item.isSoldOut && !item.availabilityMessage).map((item) => item.id),
    });

    if (verdict.accepted) voucher = verdict.voucher;
    else
      voucherMessage =
        guest && verdict.reason === "expired"
          ? GUEST_EXPIRED_VOUCHER_MESSAGE
          : VOUCHER_REFUSAL_MESSAGE[verdict.reason];
  }

  const cart = buildCart(catalogue, request.addonQuantities, voucher);

  const price = (at: PricingContext, manualTotalFils: number | null) =>
    priceBooking({
      context: at,
      tiers,
      guests: { adults: request.adults, childAges: request.childAges },
      addons: cart.map((line) => ({
        isTaxable: catalogue.find((item) => item.id === line.id)?.isTaxable ?? true,
        id: line.id,
        name: line.name,
        regularUnitPriceFils: line.regularUnitPriceFils,
        unitPriceFils: line.unitPriceFils,
        quantity: line.quantity,
        isLocked: line.isLocked,
      })),
      promotion: bookingPromotionFrom(voucher),
      serviceFee: options.includeServiceFee === true ? serviceFeeFrom(snapshot) : null,
      tax: taxFrom(snapshot),
      roundingFils: requireSetting(snapshot, "pricing.rounding_fils"),
      manualTotalFils,
    });

  const breakdown = price(context, request.manualTotalFils);

  const durationTotals: Record<number, number> = {};

  for (const hours of request.comparisonDurationsHours ?? []) {
    const compared =
      hours === request.durationHours
        ? breakdown
        : price(dubaiContextFor(request.startsAt, hours), null);

    if (compared.outcome === "priced") durationTotals[hours] = compared.totalFils;
  }

  return {
    durationTotals,
    breakdown,
    cart,
    catalogue,
    voucher,
    voucherMessage,
    offerLabel: requireSetting(snapshot, "pricing.offer_label"),
    currency: requireSetting(snapshot, "pricing.currency"),
  };
}
