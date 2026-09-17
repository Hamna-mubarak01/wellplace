export const ADDON_KINDS = [
  "rental",
  "consumable",
  "per_person",
  "per_booking",
] as const;

export type AddonKind = (typeof ADDON_KINDS)[number];

export const ADDON_KIND_LABEL: Readonly<Record<AddonKind, string>> = {
  rental: "Rental",
  consumable: "Consumable",
  per_person: "Per guest",
  per_booking: "Per booking",
};

export function addonKindLabel(kind: string): string | null {
  return kind in ADDON_KIND_LABEL ? ADDON_KIND_LABEL[kind as AddonKind] : null;
}
