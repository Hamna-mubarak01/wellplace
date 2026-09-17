export type VoucherKind = "fixed" | "percent" | "addon_free";

export interface Voucher {
  readonly code: string;
  readonly kind: VoucherKind;
  readonly amountFils: number | null;
  readonly percent: number | null;
  readonly targetAddonIds: readonly string[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly maxUses: number | null;
  readonly usedCount: number;
  readonly perCustomerLimit: number | null;
  readonly customerUsedCount: number;
  readonly isCombinable: boolean;
  readonly isActive: boolean;
}

export type VoucherRefusal =
  | "unknown_code"
  | "inactive"
  | "not_yet_valid"
  | "expired"
  | "usage_limit_reached"
  | "customer_limit_reached"
  | "not_combinable"
  | "no_eligible_addon";

export type VoucherVerdict =
  | { readonly accepted: true; readonly voucher: Voucher }
  | { readonly accepted: false; readonly reason: VoucherRefusal };

export const VOUCHER_REFUSAL_MESSAGE: Readonly<Record<VoucherRefusal, string>> = {
  unknown_code: "That code was not recognised.",
  inactive: "That code is no longer active.",
  not_yet_valid: "That code cannot be used yet.",
  expired: "That code has expired.",
  usage_limit_reached: "That code has been used the maximum number of times.",
  customer_limit_reached: "This guest has already used that code.",
  not_combinable: "That code cannot be combined with another offer.",
  no_eligible_addon: "That code does not apply to anything in this booking.",
};

export const GUEST_INVALID_VOUCHER_MESSAGE = "Invalid coupon.";
export const GUEST_EXPIRED_VOUCHER_MESSAGE = GUEST_INVALID_VOUCHER_MESSAGE;

export interface VoucherContext {
  readonly isoDate: string;
  readonly hasOtherPromotion: boolean;
  readonly availableAddonIds: readonly string[];
}

export function checkVoucher(
  voucher: Voucher | null,
  context: VoucherContext,
): VoucherVerdict {
  if (voucher === null) return { accepted: false, reason: "unknown_code" };
  if (!voucher.isActive) return { accepted: false, reason: "inactive" };

  if (voucher.validFrom !== null && context.isoDate < voucher.validFrom) {
    return { accepted: false, reason: "not_yet_valid" };
  }

  if (voucher.validTo !== null && context.isoDate > voucher.validTo) {
    return { accepted: false, reason: "expired" };
  }

  if (voucher.maxUses !== null && voucher.usedCount >= voucher.maxUses) {
    return { accepted: false, reason: "usage_limit_reached" };
  }

  if (
    voucher.perCustomerLimit !== null &&
    voucher.customerUsedCount >= voucher.perCustomerLimit
  ) {
    return { accepted: false, reason: "customer_limit_reached" };
  }

  if (!voucher.isCombinable && context.hasOtherPromotion) {
    return { accepted: false, reason: "not_combinable" };
  }

  if (voucher.kind === "addon_free") {
    const eligible = voucher.targetAddonIds.filter((id) =>
      context.availableAddonIds.includes(id),
    );
    if (eligible.length === 0) {
      return { accepted: false, reason: "no_eligible_addon" };
    }
  }

  return { accepted: true, voucher };
}

export interface CartAddon {
  readonly isSoldOut?: boolean;
  readonly availabilityMessage?: string | null;
  readonly id: string;
  readonly name: string;
  readonly regularUnitPriceFils: number;
  readonly offerUnitPriceFils: number;
  readonly defaultQuantity: number;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly isLocked: boolean;
}

export interface CartLine {
  readonly id: string;
  readonly name: string;
  readonly regularUnitPriceFils: number;
  readonly unitPriceFils: number;
  readonly quantity: number;
  readonly isLocked: boolean;
  readonly isIncluded: boolean;
  readonly voucherCode: string | null;
}

export function clampQuantity(addon: CartAddon, quantity: number): number {
  if (!Number.isFinite(quantity)) return 0;
  const whole = Math.trunc(quantity);
  if (whole <= 0) return 0;
  return Math.min(Math.max(whole, addon.minQuantity), addon.maxQuantity);
}

export function isAutomaticallyIncluded(addon: CartAddon): boolean {
  return addon.offerUnitPriceFils === 0;
}

export type CartVoucher = Pick<Voucher, "code" | "kind" | "targetAddonIds">;

export function buildCart(
  catalogue: readonly CartAddon[],
  chosen: Readonly<Record<string, number>>,
  voucher: CartVoucher | null,
): readonly CartLine[] {
  const freeIds =
    voucher !== null && voucher.kind === "addon_free" ? voucher.targetAddonIds : [];

  const lines: CartLine[] = [];

  for (const addon of catalogue) {
    if (addon.isSoldOut || addon.availabilityMessage) continue;
    const targeted = freeIds.includes(addon.id);
    const included = isAutomaticallyIncluded(addon);

    const requested = chosen[addon.id];
    const hasRequest = typeof requested === "number";

    if (!included && !targeted && !hasRequest) continue;

    const quantity = (included || targeted) && addon.isLocked && (!hasRequest || requested <= 0)
      ? clampQuantity(addon, addon.defaultQuantity)
      : hasRequest
      ? clampQuantity(addon, requested)
      : clampQuantity(addon, addon.defaultQuantity);

    if (quantity === 0) continue;

    const unitPriceFils = targeted ? 0 : addon.offerUnitPriceFils;
    const reducedByVoucher = targeted && addon.offerUnitPriceFils > 0;

    lines.push({
      id: addon.id,
      name: addon.name,
      regularUnitPriceFils: addon.regularUnitPriceFils,
      unitPriceFils,
      quantity,
      isLocked: addon.isLocked,
      isIncluded: unitPriceFils === 0,
      voucherCode: reducedByVoucher ? (voucher?.code ?? null) : null,
    });
  }

  return lines;
}

export function bookingPromotionFrom(
  voucher: Voucher | null,
): { code: string; kind: "fixed" | "percent"; amountFils: number | null; percent: number | null } | null {
  if (voucher === null) return null;
  if (voucher.kind === "addon_free") return null;

  return {
    code: voucher.code,
    kind: voucher.kind,
    amountFils: voucher.amountFils,
    percent: voucher.percent,
  };
}
