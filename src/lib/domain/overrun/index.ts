export type OverrunGuestKind = "adult" | "child";

export type OverrunRateSource = "regular_hourly" | "offer_hourly" | "fixed";

export const OVERRUN_RATE_SOURCES: readonly OverrunRateSource[] = [
  "regular_hourly",
  "offer_hourly",
  "fixed",
];

export interface OverrunInput {
  readonly scheduledEnd: Date;
  readonly actualEnd: Date;
  readonly incrementMinutes: number;
}

export interface OverrunMeasurement {
  readonly overrunMinutes: number;
  readonly chargeableIncrements: number;
  readonly chargeableMinutes: number;
}

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

export function measureOverrun({
  scheduledEnd,
  actualEnd,
  incrementMinutes,
}: OverrunInput): OverrunMeasurement {
  if (!Number.isFinite(incrementMinutes) || incrementMinutes <= 0) {
    throw new RangeError("incrementMinutes must be a positive number");
  }

  const elapsed = actualEnd.getTime() - scheduledEnd.getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return { overrunMinutes: 0, chargeableIncrements: 0, chargeableMinutes: 0 };
  }

  const overrunMinutes = Math.ceil(elapsed / MILLISECONDS_PER_MINUTE);
  const chargeableIncrements = Math.ceil(overrunMinutes / incrementMinutes);

  return {
    overrunMinutes,
    chargeableIncrements,
    chargeableMinutes: chargeableIncrements * incrementMinutes,
  };
}

export function overrunChargeFils(
  measurement: OverrunMeasurement,
  pricePerIncrementFils: number,
): number {
  return measurement.chargeableIncrements * pricePerIncrementFils;
}

export function lateArrivalMinutes(
  scheduledStart: Date,
  arrivedAt: Date,
): number {
  const elapsed = arrivedAt.getTime() - scheduledStart.getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.floor(elapsed / MILLISECONDS_PER_MINUTE);
}

export interface OverrunPriceTier {
  readonly id: string;
  readonly guestKind: OverrunGuestKind;
  readonly fromHour: number;
  readonly toHour: number | null;
  readonly regularFilsPerHour: number;
  readonly offerFilsPerHour: number | null;
  readonly offerPercent: number | null;
  readonly priority: number;
}

export function continuationHourOf(bookedMinutes: number): number {
  if (!Number.isFinite(bookedMinutes) || bookedMinutes <= 0) return 1;
  return Math.floor(bookedMinutes / MINUTES_PER_HOUR) + 1;
}

function coversHour(tier: OverrunPriceTier, hour: number): boolean {
  if (hour < tier.fromHour) return false;
  return tier.toHour === null || hour <= tier.toHour;
}

function isNarrower(tier: OverrunPriceTier, best: OverrunPriceTier): boolean {
  const tierBand = tier.toHour === null ? 0 : 1;
  const bestBand = best.toHour === null ? 0 : 1;
  if (tierBand !== bestBand) return tierBand > bestBand;
  return tier.id < best.id;
}

export function selectOverrunTier(
  tiers: readonly OverrunPriceTier[],
  guestKind: OverrunGuestKind,
  hour: number,
): OverrunPriceTier | null {
  const matches = tiers.filter(
    (tier) => tier.guestKind === guestKind && coversHour(tier, hour),
  );

  if (matches.length === 0) return null;

  return matches.reduce((best, tier) => {
    if (tier.priority !== best.priority) {
      return tier.priority > best.priority ? tier : best;
    }
    return isNarrower(tier, best) ? tier : best;
  });
}

export interface OverrunRateInput {
  readonly tiers: readonly OverrunPriceTier[];
  readonly guestKind: OverrunGuestKind;
  readonly continuationHour: number;
  readonly rateSource: OverrunRateSource;
  readonly incrementMinutes: number;
  readonly fixedFilsPerIncrement: number | null;
  readonly roundingFils: number;
}

function offerRateOf(tier: OverrunPriceTier, roundingFils: number): number {
  if (tier.offerFilsPerHour !== null) return tier.offerFilsPerHour;
  if (tier.offerPercent === null || tier.offerPercent <= 0) {
    return tier.regularFilsPerHour;
  }

  const discounted =
    tier.regularFilsPerHour - (tier.regularFilsPerHour * tier.offerPercent) / 100;

  if (!Number.isFinite(roundingFils) || roundingFils <= 1) {
    return Math.max(0, Math.round(discounted));
  }

  return Math.max(0, Math.round(discounted / roundingFils) * roundingFils);
}

export function overrunRatePerIncrementFils({
  tiers,
  guestKind,
  continuationHour,
  rateSource,
  incrementMinutes,
  fixedFilsPerIncrement,
  roundingFils,
}: OverrunRateInput): number | null {
  if (!Number.isFinite(incrementMinutes) || incrementMinutes <= 0) return null;

  if (rateSource === "fixed") {
    if (
      fixedFilsPerIncrement === null ||
      !Number.isFinite(fixedFilsPerIncrement) ||
      fixedFilsPerIncrement < 0
    ) {
      return null;
    }
    return Math.round(fixedFilsPerIncrement);
  }

  const tier = selectOverrunTier(tiers, guestKind, continuationHour);
  if (tier === null) return null;

  const hourlyFils =
    rateSource === "offer_hourly"
      ? offerRateOf(tier, roundingFils)
      : tier.regularFilsPerHour;

  if (!Number.isFinite(hourlyFils) || hourlyFils < 0) return null;

  return Math.round((hourlyFils * incrementMinutes) / MINUTES_PER_HOUR);
}

export interface OverrunGuestCounts {
  readonly adults: number;
  readonly children: number;
}

export interface OverrunChargeLine {
  readonly guestKind: OverrunGuestKind;
  readonly guests: number;
  readonly ratePerIncrementFils: number;
  readonly amountFils: number;
}

export interface OverrunChargeInput {
  readonly scheduledEnd: Date;
  readonly actualEnd: Date;
  readonly bookedMinutes: number;
  readonly incrementMinutes: number;
  readonly guests: OverrunGuestCounts;
  readonly tiers: readonly OverrunPriceTier[];
  readonly rateSource: OverrunRateSource;
  readonly fixedFilsPerIncrement: number | null;
  readonly roundingFils: number;
}

export interface OverrunCharge {
  readonly overrunMinutes: number;
  readonly chargeableIncrements: number;
  readonly chargeableMinutes: number;
  readonly incrementMinutes: number;
  readonly rateSource: OverrunRateSource;
  readonly continuationHour: number;
  readonly adultRatePerIncrementFils: number | null;
  readonly childRatePerIncrementFils: number | null;
  readonly lines: readonly OverrunChargeLine[];
  readonly totalFils: number | null;
}

function guestCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

export function priceOverrun({
  scheduledEnd,
  actualEnd,
  bookedMinutes,
  incrementMinutes,
  guests,
  tiers,
  rateSource,
  fixedFilsPerIncrement,
  roundingFils,
}: OverrunChargeInput): OverrunCharge {
  const measurement = measureOverrun({ scheduledEnd, actualEnd, incrementMinutes });
  const continuationHour = continuationHourOf(bookedMinutes);

  const rateFor = (guestKind: OverrunGuestKind) =>
    overrunRatePerIncrementFils({
      tiers,
      guestKind,
      continuationHour,
      rateSource,
      incrementMinutes,
      fixedFilsPerIncrement,
      roundingFils,
    });

  const adults = guestCount(guests.adults);
  const children = guestCount(guests.children);

  const adultRate = adults > 0 ? rateFor("adult") : null;
  const childRate = children > 0 ? rateFor("child") : null;

  const unpriced =
    (adults > 0 && adultRate === null) || (children > 0 && childRate === null);

  const lines: OverrunChargeLine[] = [];

  if (adults > 0 && adultRate !== null) {
    lines.push({
      guestKind: "adult",
      guests: adults,
      ratePerIncrementFils: adultRate,
      amountFils: adults * adultRate * measurement.chargeableIncrements,
    });
  }

  if (children > 0 && childRate !== null) {
    lines.push({
      guestKind: "child",
      guests: children,
      ratePerIncrementFils: childRate,
      amountFils: children * childRate * measurement.chargeableIncrements,
    });
  }

  return {
    overrunMinutes: measurement.overrunMinutes,
    chargeableIncrements: measurement.chargeableIncrements,
    chargeableMinutes: measurement.chargeableMinutes,
    incrementMinutes,
    rateSource,
    continuationHour,
    adultRatePerIncrementFils: adultRate,
    childRatePerIncrementFils: childRate,
    lines,
    totalFils: unpriced
      ? null
      : lines.reduce((sum, line) => sum + line.amountFils, 0),
  };
}
