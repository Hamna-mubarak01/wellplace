import {
  COUPON_LIMITS,
  couponPreviewSchema,
  couponTemplateSchema,
  type CouponPreviewRequest,
  type CouponRow,
  type CouponTemplate,
} from "@/lib/config/coupons";
import { parseAed, toAedInput } from "@/components/shared/money";

export type CouponKind = CouponRow["kind"];

export interface CouponAddonOption {
  readonly id: string;
  readonly name: string;
}

export type CouponAddonChoices = readonly CouponAddonOption[] | null;

export interface CouponTermsDraft {
  readonly kind: CouponKind;
  readonly value: string;
  readonly addonIds: readonly string[];
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly maxUses: number | null;
  readonly perCustomerLimit: number | null;
  readonly isCombinable: boolean;
  readonly isActive: boolean;
}

export type CouponTermsField = "value" | "addonIds" | "validFrom" | "validTo" | "maxUses" | "perCustomerLimit";

export interface CouponFieldIssue<Field extends string> {
  readonly field: Field | null;
  readonly message: string;
}

export const NEW_COUPON_TERMS: CouponTermsDraft = {
  kind: "percent",
  value: "",
  addonIds: [],
  validFrom: null,
  validTo: null,
  maxUses: null,
  perCustomerLimit: COUPON_LIMITS.perCustomerDefault,
  isCombinable: true,
  isActive: true,
};

const TERMS_FIELD_BY_PATH: Readonly<Record<string, CouponTermsField>> = {
  amountFils: "value",
  percent: "value",
  addonIds: "addonIds",
  validFrom: "validFrom",
  validTo: "validTo",
  maxUses: "maxUses",
  perCustomerLimit: "perCustomerLimit",
};

export function termsFieldForPath(path: PropertyKey | undefined): CouponTermsField | null {
  return typeof path === "string" ? (TERMS_FIELD_BY_PATH[path] ?? null) : null;
}

export function termsFromCoupon(row: CouponRow): CouponTermsDraft {
  return {
    kind: row.kind,
    value:
      row.kind === "fixed"
        ? row.amountFils === null
          ? ""
          : toAedInput(row.amountFils)
        : row.kind === "percent" && row.percent !== null
          ? String(row.percent)
          : "",
    addonIds: row.kind === "addon_free" ? row.addonIds : [],
    validFrom: row.validFrom,
    validTo: row.validTo,
    maxUses: row.maxUses,
    perCustomerLimit: row.perCustomerLimit,
    isCombinable: row.isCombinable,
    isActive: row.isActive,
  };
}

function percentFromInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const percent = Number(trimmed);
  return Number.isFinite(percent) ? percent : null;
}

export function templateFromTerms(draft: CouponTermsDraft): CouponTemplate {
  return {
    kind: draft.kind,
    amountFils: draft.kind === "fixed" ? parseAed(draft.value) : null,
    percent: draft.kind === "percent" ? percentFromInput(draft.value) : null,
    addonIds: draft.kind === "addon_free" ? [...draft.addonIds] : [],
    validFrom: draft.validFrom,
    validTo: draft.validTo,
    maxUses: draft.maxUses,
    perCustomerLimit: draft.perCustomerLimit,
    isCombinable: draft.isCombinable,
    isActive: draft.isActive,
  };
}

export function termsIssue(draft: CouponTermsDraft): CouponFieldIssue<CouponTermsField> | null {
  const parsed = couponTemplateSchema.safeParse(templateFromTerms(draft));
  if (parsed.success) return null;
  const [issue] = parsed.error.issues;
  return { field: termsFieldForPath(issue.path[0]), message: issue.message };
}

export function previewRequestFromTerms(draft: CouponTermsDraft, uses: number): CouponPreviewRequest | null {
  const template = templateFromTerms(draft);
  const parsed = couponPreviewSchema.safeParse({
    kind: template.kind,
    amountFils: template.amountFils,
    percent: template.percent,
    addonIds: template.addonIds,
    uses,
  });
  return parsed.success ? parsed.data : null;
}
