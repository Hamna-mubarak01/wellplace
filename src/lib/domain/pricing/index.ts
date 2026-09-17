export type GuestKind = "adult" | "child";

export interface TimeWindow {
  readonly fromMinutes: number;
  readonly toMinutes: number;
}

export interface PriceTier {
  readonly id: string;
  readonly guestKind: GuestKind;
  readonly fromHour: number;
  readonly toHour: number | null;
  readonly regularFilsPerHour: number;
  readonly offerFilsPerHour: number | null;
  readonly offerPercent: number | null;
  readonly weekdays: readonly number[] | null;
  readonly seasonFrom: string | null;
  readonly seasonTo: string | null;
  readonly startWindow: TimeWindow | null;
  readonly priority: number;
}

export interface PricingContext {
  readonly isoDate: string;
  readonly weekday: number;
  readonly startMinutes: number;
  readonly durationHours: number;
}

export interface GuestCounts {
  readonly adults: number;
  readonly childAges: readonly number[];
}

export interface AddonSelection {
  readonly isTaxable?: boolean;
  readonly id: string;
  readonly name: string;
  readonly regularUnitPriceFils: number;
  readonly unitPriceFils: number;
  readonly quantity: number;
  readonly isLocked: boolean;
}

export type PromotionKind = "fixed" | "percent";

export interface Promotion {
  readonly code: string;
  readonly kind: PromotionKind;
  readonly amountFils: number | null;
  readonly percent: number | null;
}

export interface ServiceFeeConfig {
  readonly enabled: boolean;
  readonly percent: number;
  readonly label: string;
}

export interface TaxConfig {
  readonly percent: number;
  readonly inclusive: boolean;
  readonly label: string;
}

export interface PricingInput {
  readonly context: PricingContext;
  readonly tiers: readonly PriceTier[];
  readonly guests: GuestCounts;
  readonly addons: readonly AddonSelection[];
  readonly promotion: Promotion | null;
  readonly serviceFee: ServiceFeeConfig | null;
  readonly tax: TaxConfig | null;
  readonly roundingFils: number;
  readonly manualTotalFils: number | null;
}

export type PriceLineKind =
  | "adults"
  | "children"
  | "addon"
  | "discount"
  | "service_fee"
  | "tax";

export interface PriceLine {
  readonly id: string;
  readonly kind: PriceLineKind;
  readonly label: string;
  readonly quantity: number | null;
  readonly unitPriceFils: number | null;
  readonly regularUnitPriceFils: number | null;
  readonly amountFils: number;
  readonly isIncluded: boolean;
}

export type PricingOutcome = "priced" | "no_tier" | "manual";

export interface PersonPrice {
  readonly regularFils: number;
  readonly offerFils: number;
  readonly savingFils: number;
  readonly savingPercent: number;
}

export interface PricedBreakdown {
  readonly outcome: PricingOutcome;
  readonly lines: readonly PriceLine[];
  readonly adultPrice: PersonPrice | null;
  readonly childPrice: PersonPrice | null;
  readonly regularSubtotalFils: number;
  readonly subtotalFils: number;
  readonly discountFils: number;
  readonly addonsTotalFils: number;
  readonly orderValueFils: number;
  readonly serviceFeeFils: number;
  readonly taxFils: number;
  readonly taxIsIncluded: boolean;
  readonly netFils: number;
  readonly totalFils: number;
  readonly regularTotalFils: number;
  readonly savingFils: number;
  readonly savingPercent: number;
  readonly promotionApplied: boolean;
}

export function percentOfFils(baseFils: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((baseFils * percent) / 100);
}

export function roundToFils(amountFils: number, roundingFils: number): number {
  if (!Number.isFinite(roundingFils) || roundingFils <= 1) {
    return Math.round(amountFils);
  }
  return Math.round(amountFils / roundingFils) * roundingFils;
}

export function savingPercentOf(regularFils: number, offerFils: number): number {
  if (regularFils <= 0 || offerFils >= regularFils) return 0;
  return Math.round(((regularFils - offerFils) / regularFils) * 100);
}

export function resolveOfferRate(tier: PriceTier, roundingFils: number): number {
  if (tier.offerFilsPerHour !== null) return tier.offerFilsPerHour;

  if (tier.offerPercent === null || tier.offerPercent <= 0) {
    return tier.regularFilsPerHour;
  }

  const discounted =
    tier.regularFilsPerHour - (tier.regularFilsPerHour * tier.offerPercent) / 100;

  return Math.max(0, roundToFils(discounted, roundingFils));
}

function withinSeason(tier: PriceTier, isoDate: string): boolean {
  if (tier.seasonFrom !== null && isoDate < tier.seasonFrom) return false;
  if (tier.seasonTo !== null && isoDate > tier.seasonTo) return false;
  return true;
}

function withinWindow(tier: PriceTier, startMinutes: number): boolean {
  if (tier.startWindow === null) return true;
  const { fromMinutes, toMinutes } = tier.startWindow;
  return startMinutes >= fromMinutes && startMinutes < toMinutes;
}

function coversHour(tier: PriceTier, hour: number): boolean {
  if (hour < tier.fromHour) return false;
  return tier.toHour === null || hour <= tier.toHour;
}

function specificity(tier: PriceTier): number {
  let score = 0;
  if (tier.weekdays !== null) score += 1;
  if (tier.seasonFrom !== null || tier.seasonTo !== null) score += 1;
  if (tier.startWindow !== null) score += 1;
  if (tier.toHour !== null) score += 1;
  return score;
}

export function selectTier(
  tiers: readonly PriceTier[],
  guestKind: GuestKind,
  hour: number,
  context: PricingContext,
): PriceTier | null {
  const matches = tiers.filter(
    (tier) =>
      tier.guestKind === guestKind &&
      coversHour(tier, hour) &&
      (tier.weekdays === null || tier.weekdays.includes(context.weekday)) &&
      withinSeason(tier, context.isoDate) &&
      withinWindow(tier, context.startMinutes),
  );

  if (matches.length === 0) return null;

  return matches.reduce((best, tier) => {
    if (tier.priority !== best.priority) {
      return tier.priority > best.priority ? tier : best;
    }
    if (specificity(tier) !== specificity(best)) {
      return specificity(tier) > specificity(best) ? tier : best;
    }
    return tier.id < best.id ? tier : best;
  });
}

export function pricePerPerson(
  tiers: readonly PriceTier[],
  guestKind: GuestKind,
  context: PricingContext,
  roundingFils: number,
): PersonPrice | null {
  const hours = Math.max(0, Math.trunc(context.durationHours));
  if (hours === 0) return null;

  let regularFils = 0;
  let offerFils = 0;

  for (let hour = 1; hour <= hours; hour += 1) {
    const tier = selectTier(tiers, guestKind, hour, context);
    if (tier === null) return null;

    regularFils += tier.regularFilsPerHour;
    offerFils += resolveOfferRate(tier, roundingFils);
  }

  return {
    regularFils,
    offerFils,
    savingFils: Math.max(0, regularFils - offerFils),
    savingPercent: savingPercentOf(regularFils, offerFils),
  };
}

export function taxWithin(grossFils: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return grossFils - Math.round(grossFils / (1 + percent / 100));
}

function discountFor(promotion: Promotion | null, baseFils: number): number {
  if (promotion === null) return 0;

  if (promotion.kind === "fixed") {
    return Math.max(0, Math.min(promotion.amountFils ?? 0, baseFils));
  }

  const percent = promotion.percent ?? 0;
  return Math.max(0, Math.min(percentOfFils(baseFils, percent), baseFils));
}

function addonLines(addons: readonly AddonSelection[]): PriceLine[] {
  return addons
    .filter((addon) => addon.quantity > 0)
    .map((addon) => ({
      id: `addon:${addon.id}`,
      kind: "addon" as const,
      label: addon.name,
      quantity: addon.quantity,
      unitPriceFils: addon.unitPriceFils,
      regularUnitPriceFils: addon.regularUnitPriceFils,
      amountFils: addon.unitPriceFils * addon.quantity,
      isIncluded: addon.unitPriceFils === 0,
    }));
}

function emptyBreakdown(
  outcome: PricingOutcome,
  totalFils: number,
  lines: readonly PriceLine[],
  tax: TaxConfig | null,
): PricedBreakdown {
  const taxIsIncluded = tax?.inclusive ?? true;
  const taxFils =
    tax === null || !tax.inclusive ? 0 : taxWithin(totalFils, tax.percent);

  return {
    outcome,
    lines,
    adultPrice: null,
    childPrice: null,
    regularSubtotalFils: totalFils,
    subtotalFils: totalFils,
    discountFils: 0,
    addonsTotalFils: 0,
    orderValueFils: totalFils,
    serviceFeeFils: 0,
    taxFils,
    taxIsIncluded,
    netFils: totalFils - taxFils,
    totalFils,
    regularTotalFils: totalFils,
    savingFils: 0,
    savingPercent: 0,
    promotionApplied: false,
  };
}

export function priceBooking(input: PricingInput): PricedBreakdown {
  const { context, tiers, guests, addons, promotion, serviceFee, tax } = input;
  const roundingFils = input.roundingFils;

  if (input.manualTotalFils !== null) {
    const total = Math.max(0, Math.round(input.manualTotalFils));
    return emptyBreakdown(
      "manual",
      total,
      [
        {
          id: "manual",
          kind: "adults",
          label: "Agreed price",
          quantity: null,
          unitPriceFils: null,
          regularUnitPriceFils: null,
          amountFils: total,
          isIncluded: false,
        },
      ],
      tax,
    );
  }

  const adultPrice =
    guests.adults > 0
      ? pricePerPerson(tiers, "adult", context, roundingFils)
      : null;
  const childPrice =
    guests.childAges.length > 0
      ? pricePerPerson(tiers, "child", context, roundingFils)
      : null;

  const adultsMissing = guests.adults > 0 && adultPrice === null;
  const childrenMissing = guests.childAges.length > 0 && childPrice === null;

  if (adultsMissing || childrenMissing) {
    return emptyBreakdown("no_tier", 0, [], tax);
  }

  const children = guests.childAges.length;

  const adultOfferFils = (adultPrice?.offerFils ?? 0) * guests.adults;
  const adultRegularFils = (adultPrice?.regularFils ?? 0) * guests.adults;
  const childOfferFils = (childPrice?.offerFils ?? 0) * children;
  const childRegularFils = (childPrice?.regularFils ?? 0) * children;

  const subtotalFils = adultOfferFils + childOfferFils;
  const regularSubtotalFils = adultRegularFils + childRegularFils;

  const lines: PriceLine[] = [];

  if (guests.adults > 0 && adultPrice !== null) {
    lines.push({
      id: "adults",
      kind: "adults",
      label: guests.adults === 1 ? "Adult" : "Adults",
      quantity: guests.adults,
      unitPriceFils: adultPrice.offerFils,
      regularUnitPriceFils: adultPrice.regularFils,
      amountFils: adultOfferFils,
      isIncluded: false,
    });
  }

  if (children > 0 && childPrice !== null) {
    lines.push({
      id: "children",
      kind: "children",
      label: children === 1 ? "Child" : "Children",
      quantity: children,
      unitPriceFils: childPrice.offerFils,
      regularUnitPriceFils: childPrice.regularFils,
      amountFils: childOfferFils,
      isIncluded: false,
    });
  }

  const addonRows = addonLines(addons);
  const addonsTotalFils = addonRows.reduce((sum, line) => sum + line.amountFils, 0);
  const regularAddonsFils = addons
    .filter((addon) => addon.quantity > 0)
    .reduce((sum, addon) => sum + addon.regularUnitPriceFils * addon.quantity, 0);

  lines.push(...addonRows);

  const discountFils = discountFor(promotion, subtotalFils);
  const orderValueFils = subtotalFils - discountFils + addonsTotalFils;
  const exemptAddonsFils = addons.filter((addon) => addon.isTaxable === false)
    .reduce((total, addon) => total + addon.unitPriceFils * addon.quantity, 0);
  const taxableValueFils = orderValueFils - exemptAddonsFils;

  const serviceFeeFils =
    serviceFee !== null && serviceFee.enabled
      ? percentOfFils(orderValueFils, serviceFee.percent)
      : 0;

  const taxIsIncluded = tax?.inclusive ?? true;

  const taxFils =
    tax === null
      ? 0
      : tax.inclusive
        ? taxWithin(taxableValueFils, tax.percent)
        : percentOfFils(taxableValueFils, tax.percent);

  const totalFils =
    tax !== null && !tax.inclusive
      ? orderValueFils + serviceFeeFils + taxFils
      : orderValueFils + serviceFeeFils;

  if (discountFils > 0 && promotion !== null) {
    lines.push({
      id: "discount",
      kind: "discount",
      label: `Promotion ${promotion.code}`,
      quantity: null,
      unitPriceFils: null,
      regularUnitPriceFils: null,
      amountFils: -discountFils,
      isIncluded: false,
    });
  }

  if (serviceFeeFils > 0 && serviceFee !== null) {
    lines.push({
      id: "service_fee",
      kind: "service_fee",
      label: serviceFee.label,
      quantity: null,
      unitPriceFils: null,
      regularUnitPriceFils: null,
      amountFils: serviceFeeFils,
      isIncluded: false,
    });
  }

  if (taxFils > 0 && tax !== null) {
    lines.push({
      id: "tax",
      kind: "tax",
      label: tax.label,
      quantity: null,
      unitPriceFils: null,
      regularUnitPriceFils: null,
      amountFils: taxFils,
      isIncluded: tax.inclusive,
    });
  }

  const regularOrderValueFils = regularSubtotalFils + regularAddonsFils;
  const regularExemptAddonsFils = addons.filter((addon) => addon.isTaxable === false)
    .reduce((total, addon) => total + addon.regularUnitPriceFils * addon.quantity, 0);
  const regularFeeFils =
    serviceFee !== null && serviceFee.enabled
      ? percentOfFils(regularOrderValueFils, serviceFee.percent)
      : 0;
  const regularTaxFils =
    tax === null || tax.inclusive
      ? 0
      : percentOfFils(regularOrderValueFils - regularExemptAddonsFils, tax.percent);
  const regularTotalFils =
    regularOrderValueFils + regularFeeFils + regularTaxFils;

  return {
    outcome: "priced",
    lines,
    adultPrice,
    childPrice,
    regularSubtotalFils,
    subtotalFils,
    discountFils,
    addonsTotalFils,
    orderValueFils,
    serviceFeeFils,
    taxFils,
    taxIsIncluded,
    netFils: taxIsIncluded ? totalFils - taxFils : orderValueFils,
    totalFils,
    regularTotalFils,
    savingFils: Math.max(0, regularTotalFils - totalFils),
    savingPercent: savingPercentOf(regularTotalFils, totalFils),
    promotionApplied: discountFils > 0,
  };
}

export interface DailyRate {
  readonly isoDate: string;
  readonly regularFilsPerHour: number | null;
  readonly offerFilsPerHour: number | null;
  readonly varies: boolean;
}

function weekdayOfIsoDate(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function startMinuteSamples(tiers: readonly PriceTier[]): number[] {
  const samples = new Set<number>([0]);
  for (const tier of tiers) {
    if (tier.startWindow === null) continue;
    samples.add(tier.startWindow.fromMinutes);
    samples.add(tier.startWindow.toMinutes);
  }
  return [...samples].filter((minutes) => minutes >= 0 && minutes < 24 * 60).sort((a, b) => a - b);
}

export function dailyFirstHourRates(
  tiers: readonly PriceTier[],
  guestKind: GuestKind,
  isoDates: readonly string[],
  roundingFils: number,
): DailyRate[] {
  const samples = startMinuteSamples(tiers);

  return isoDates.map((isoDate) => {
    const weekday = weekdayOfIsoDate(isoDate);
    const priced = samples.flatMap((startMinutes) => {
      const tier = selectTier(tiers, guestKind, 1, { isoDate, weekday, startMinutes, durationHours: 1 });
      return tier === null ? [] : [{ regular: tier.regularFilsPerHour, offer: resolveOfferRate(tier, roundingFils) }];
    });

    if (priced.length === 0) {
      return { isoDate, regularFilsPerHour: null, offerFilsPerHour: null, varies: false };
    }

    const lowest = priced.reduce((best, rate) => (rate.offer < best.offer ? rate : best));
    const distinctOffers = new Set(priced.map((rate) => rate.offer)).size;

    return {
      isoDate,
      regularFilsPerHour: lowest.regular,
      offerFilsPerHour: lowest.offer,
      varies: distinctOffers > 1 || priced.length < samples.length,
    };
  });
}
