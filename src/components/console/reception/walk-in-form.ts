import { formatCalendarDayLong } from "@/lib/domain/time";
import type { CartAddon, CartLine, Voucher } from "@/lib/domain/vouchers";
import type { ReceptionBookingInput } from "@/lib/validation/reception-booking";
import { SALUTATIONS } from "@/lib/validation/waitlist";

export interface ReceptionAddonOption extends CartAddon {
  readonly description: string | null;
  readonly imagePath: string | null;
  readonly imageAlt: string;
  readonly savingLabel: string | null;
  readonly kind: string;
  readonly isSoldOut: boolean;
}

export interface VoucherGrant {
  readonly code: string;
  readonly addonIds: readonly string[];
}

export function grantFromCart(cart: readonly CartLine[]): VoucherGrant | null {
  const freed = cart.flatMap((line) =>
    line.voucherCode === null ? [] : [{ id: line.id, code: line.voucherCode }],
  );

  const first = freed[0];
  if (first === undefined) return null;

  return { code: first.code, addonIds: freed.map((entry) => entry.id) };
}

export function grantAsVoucher(grant: VoucherGrant | null): Voucher | null {
  if (grant === null || grant.addonIds.length === 0) return null;

  return {
    code: grant.code,
    kind: "addon_free",
    amountFils: null,
    percent: null,
    targetAddonIds: grant.addonIds,
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

export type ReceptionSource = ReceptionBookingInput["source"];

export type Salutation = (typeof SALUTATIONS)[number];

export const SALUTATION_LABEL: Readonly<Record<Salutation, string>> = {
  mr: "Mr.",
  ms: "Ms.",
};

export const WALK_IN_ID = "walk-in";

export function fieldId(part: string): string {
  return `${WALK_IN_ID}-${part}`;
}

export const CONTROL_CLASS =
  "h-tap w-full rounded-(--radius-card) bg-surface-raised px-3 text-console-body";

export const AREA_CLASS =
  "min-h-tap w-full rounded-(--radius-card) bg-surface-raised px-3 py-2 text-console-body";

export const LABEL_CLASS = "text-field-label font-medium text-text-secondary";

export const ERROR_CLASS = "text-micro font-medium";

export const HINT_CLASS = "reception-hint text-micro text-pretty text-text-muted";

export const LEGEND_CLASS =
  "mb-0 text-console-body font-semibold text-text-primary";

export const NOTE_CLASS =
  "flex items-start gap-2.5 rounded-(--radius-card) border border-border bg-surface-sunken px-3 py-2.5 text-console-body text-text-secondary";

export const DANGER_NOTE_CLASS =
  "flex items-start gap-2.5 rounded-(--radius-card) border border-danger-border bg-danger-wash px-3 py-2.5 text-console-body text-danger-ink";

export const WARNING_NOTE_CLASS =
  "flex items-start gap-2.5 rounded-(--radius-card) border border-warning-border bg-warning-wash px-3 py-2.5 text-console-body text-warning-ink";

const NOON_HOUR = 12;

export function dateKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, NOON_HOUR);
}

export function dateToKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dubaiDayLabel(dateKey: string): string {
  return formatCalendarDayLong(dateKey);
}

export interface ParseIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

export function issuesToErrors(
  issues: readonly ParseIssue[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

const FOCUS_TARGETS: Readonly<Record<string, string>> = {
  source: fieldId("source"),
  salutation: fieldId("salutation"),
  firstName: fieldId("first-name"),
  lastName: fieldId("last-name"),
  email: fieldId("email"),
  dateOfBirth: fieldId("dob-day"),
  "dateOfBirth.day": fieldId("dob-day"),
  "dateOfBirth.month": fieldId("dob-day"),
  "dateOfBirth.year": fieldId("dob-day"),
  phone: fieldId("phone"),
  "phone.e164": fieldId("phone"),
  "phone.countryIso2": fieldId("phone"),
  startsAt: fieldId("times"),
  durationHours: fieldId("duration"),
  adults: fieldId("adults"),
  guests: fieldId("adults"),
  children: fieldId("child-age-0"),
  personalRequest: fieldId("personal-request"),
  internalNote: fieldId("internal-note"),
  manualTotalFils: fieldId("agreed-price"),
  reason: fieldId("reason"),
  acceptedTerms: fieldId("terms"),
};

export function focusField(key: string): void {
  const id = FOCUS_TARGETS[key];
  if (!id) return;
  document.getElementById(id)?.focus();
}
