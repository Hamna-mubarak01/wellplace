
export interface UrgencyConfig {
  readonly enabled: boolean;
  readonly fewEnabled?: boolean;
  readonly lastEnabled?: boolean;
  readonly noneEnabled?: boolean;
  readonly mode?: "live" | "general";
  readonly textGeneral?: string;
  readonly thresholdFew: number;
  readonly thresholdLast: number;
  readonly textFew: string;
  readonly textLast: string;
  readonly textNone: string;
  readonly textFilling: string;
}

export interface TileInput {
  readonly remaining: number;

  readonly reducedByDemand: boolean;

  readonly urgency: UrgencyConfig;

  readonly securedUntil?: Date | null;
}

export type TileKind = "secured" | "available" | "unavailable";

export interface TileState {
  readonly kind: TileKind;
  readonly disabled: boolean;
  readonly message: string | null;
  readonly securedUntil: Date | null;
}

export function timeTileState(input: TileInput): TileState {
  const { remaining, urgency, securedUntil } = input;

  if (securedUntil) {
    return { kind: "secured", disabled: false, message: null, securedUntil };
  }

  if (remaining <= 0) {
    return {
      kind: "unavailable",
      disabled: true,
      message: urgency.noneEnabled === false ? null : urgency.textNone,
      securedUntil: null,
    };
  }

  const bookable = (message: string | null): TileState => ({
    kind: "available",
    disabled: false,
    message,
    securedUntil: null,
  });

  if (!urgency.enabled) return bookable(null);

  if (urgency.mode === "general") return bookable(urgency.textGeneral?.trim() || null);

  const last = Math.min(urgency.thresholdLast, urgency.thresholdFew);
  const few = Math.max(urgency.thresholdLast, urgency.thresholdFew);

  if (urgency.lastEnabled !== false && remaining <= last) return bookable(urgency.textLast);
  if (urgency.fewEnabled !== false && remaining <= few) return bookable(urgency.textFew);


  return bookable(null);
}

export function dayAvailabilityMessage(
  remainingByStart: readonly number[],
  urgency: UrgencyConfig,
): string | null {
  const bookable = remainingByStart.filter((remaining) => remaining > 0);
  if (bookable.length === 0 || !urgency.enabled) return null;

  if (urgency.mode === "general") return urgency.textGeneral?.trim() || null;

  const scarcest = Math.min(...bookable);
  const last = Math.min(urgency.thresholdLast, urgency.thresholdFew);
  const few = Math.max(urgency.thresholdLast, urgency.thresholdFew);

  if (urgency.fewEnabled !== false && scarcest <= few) return urgency.textFew;
  if (urgency.lastEnabled !== false && scarcest <= last) return urgency.textLast;

  return null;
}
