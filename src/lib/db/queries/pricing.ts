import type { AddonEligibility } from "@/lib/domain/vouchers/addon-availability";
import type { WellPlaceClient } from "@/lib/db/types";
import type { PriceTier } from "@/lib/domain/pricing";
import type { CartAddon, Voucher, VoucherKind } from "@/lib/domain/vouchers";

interface RawTier {
  id: string;
  guest_kind: "adult" | "child";
  from_hour: number;
  to_hour: number | null;
  regular_fils_per_hour: number;
  offer_fils_per_hour: number | null;
  offer_percent: string | number | null;
  weekdays: number[] | null;
  season_from: string | null;
  season_to: string | null;
  start_from_minutes: number | null;
  start_to_minutes: number | null;
  priority: number;
}

const TIER_COLUMNS =
  "id, guest_kind, from_hour, to_hour, regular_fils_per_hour, offer_fils_per_hour, offer_percent, weekdays, season_from, season_to, start_from_minutes, start_to_minutes, priority";

function toTier(raw: RawTier): PriceTier {
  const window =
    raw.start_from_minutes === null || raw.start_to_minutes === null
      ? null
      : { fromMinutes: raw.start_from_minutes, toMinutes: raw.start_to_minutes };

  return {
    id: raw.id,
    guestKind: raw.guest_kind,
    fromHour: raw.from_hour,
    toHour: raw.to_hour,
    regularFilsPerHour: raw.regular_fils_per_hour,
    offerFilsPerHour: raw.offer_fils_per_hour,
    offerPercent: raw.offer_percent === null ? null : Number(raw.offer_percent),
    weekdays: raw.weekdays,
    seasonFrom: raw.season_from,
    seasonTo: raw.season_to,
    startWindow: window,
    priority: raw.priority,
  };
}

export type PriceTierListing =
  | { ok: true; tiers: PriceTier[] }
  | { ok: false; message: string };

export async function listPriceTiers(
  client: WellPlaceClient,
): Promise<PriceTierListing> {
  const { data, error } = await client
    .from("public_price_rules")
    .select(TIER_COLUMNS)
    .order("priority", { ascending: false })
    .order("from_hour", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    tiers: (data ?? []).map((row) => toTier(row as unknown as RawTier)),
  };
}

interface RawAddon {
  eligible_min_guests?: number | null;
  eligible_max_guests?: number | null;
  eligible_min_hours?: number | null;
  eligible_max_hours?: number | null;
  is_taxable?: boolean;
  id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  regular_price_fils: number;
  offer_price_fils: number;
  saving_label: string | null;
  kind: string;
  default_quantity: number;
  min_quantity: number;
  max_quantity: number;
  is_locked: boolean;
}

const ADDON_COLUMNS =
  "id, name, description, image_path, regular_price_fils, offer_price_fils, saving_label, kind, default_quantity, min_quantity, max_quantity, is_locked, is_taxable, eligible_min_guests, eligible_max_guests, eligible_min_hours, eligible_max_hours";

export interface AddonCatalogueItem extends CartAddon, AddonEligibility {
  readonly isTaxable?: boolean;
  readonly description: string | null;
  readonly imagePath: string | null;
  readonly savingLabel: string | null;
  readonly kind: string;
  readonly isSoldOut: boolean;
}

export interface StaffAddonCatalogueItem extends AddonCatalogueItem {
  readonly receptionNote: string | null;
}

export type AddonCatalogueListing =
  | { ok: true; addons: StaffAddonCatalogueItem[] }
  | { ok: false; message: string };

function toAddon(raw: RawAddon & { is_sold_out?: boolean }): AddonCatalogueItem {
  return {
    eligibleMinGuests: raw.eligible_min_guests ?? null,
    eligibleMaxGuests: raw.eligible_max_guests ?? null,
    eligibleMinHours: raw.eligible_min_hours ?? null,
    eligibleMaxHours: raw.eligible_max_hours ?? null,
    isTaxable: raw.is_taxable ?? true,
    isSoldOut: raw.is_sold_out ?? false,
    id: raw.id,
    name: raw.name,
    description: raw.description,
    imagePath: raw.image_path,
    savingLabel: raw.saving_label,
    kind: raw.kind,
    regularUnitPriceFils: raw.regular_price_fils,
    offerUnitPriceFils: raw.offer_price_fils,
    defaultQuantity: raw.default_quantity,
    minQuantity: raw.min_quantity,
    maxQuantity: raw.max_quantity,
    isLocked: raw.is_locked,
  };
}

export async function listAddonCatalogue(
  client: WellPlaceClient,
): Promise<AddonCatalogueListing> {
  const { data, error } = await client
    .from("staff_addons")
    .select(`${ADDON_COLUMNS}, is_sold_out, reception_note`)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    addons: (data ?? []).map((row) => {
      const raw = row as unknown as RawAddon & {
        is_sold_out: boolean;
        reception_note: string | null;
      };

      return { ...toAddon(raw), receptionNote: raw.reception_note };
    }),
  };
}

export async function findVoucher(
  client: WellPlaceClient,
  code: string,
  customerId: string | null,
): Promise<Voucher | null> {
  const normalised = code.trim().toUpperCase();
  if (normalised.length === 0) return null;

  const { data, error } = await client
    .from("promo_codes")
    .select(
      "id, code, kind, amount_fils, percent, valid_from, valid_to, max_uses, used_count, per_customer_limit, is_combinable, is_active, promo_code_addons ( addon_id )",
    )
    .eq("code", normalised)
    .maybeSingle();

  if (error) {
    console.error("[db] findVoucher failed:", error.message);
    throw new Error("Coupons could not be checked. Please try again.");
  }
  if (!data) return null;

  const raw = data as unknown as {
    id: string;
    code: string;
    kind: VoucherKind;
    amount_fils: number | null;
    percent: string | number | null;
    valid_from: string | null;
    valid_to: string | null;
    max_uses: number | null;
    used_count: number;
    per_customer_limit: number | null;
    is_combinable: boolean;
    is_active: boolean;
    promo_code_addons: { addon_id: string }[] | null;
  };

  let customerUsedCount = 0;

  if (customerId !== null && raw.per_customer_limit !== null) {
    const { count, error: countError } = await client
      .from("promo_code_redemptions")
      .select("promo_code_id", { count: "exact", head: true })
      .eq("promo_code_id", raw.id)
      .eq("customer_id", customerId);

    if (countError || count === null) throw new Error("Coupon usage could not be checked. Please try again.");
    customerUsedCount = count;
  }

  return {
    code: raw.code,
    kind: raw.kind,
    amountFils: raw.amount_fils,
    percent: raw.percent === null ? null : Number(raw.percent),
    targetAddonIds: (raw.promo_code_addons ?? []).map((row) => row.addon_id),
    validFrom: raw.valid_from,
    validTo: raw.valid_to,
    maxUses: raw.max_uses,
    usedCount: raw.used_count,
    perCustomerLimit: raw.per_customer_limit,
    customerUsedCount,
    isCombinable: raw.is_combinable,
    isActive: raw.is_active,
  };
}

export async function listPublicPriceTiers(
  client: WellPlaceClient,
): Promise<PriceTier[]> {
  const { data, error } = await client
    .from("public_price_rules")
    .select(TIER_COLUMNS)
    .order("priority", { ascending: false })
    .order("from_hour", { ascending: true });

  if (error) {
    console.error("[db] listPublicPriceTiers failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => toTier(row as unknown as RawTier));
}

export async function listPublicAddons(
  client: WellPlaceClient,
): Promise<AddonCatalogueItem[]> {
  const { data, error } = await client
    .from("public_addons")
    .select(`${ADDON_COLUMNS}, is_sold_out`);

  if (error) {
    console.error("[db] listPublicAddons failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    toAddon(row as unknown as RawAddon & { is_sold_out: boolean }),
  );
}
