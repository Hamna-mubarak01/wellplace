import {
  COUPON_CODE_RULES,
  COUPON_GENERATION,
  COUPON_PATTERN_MESSAGE,
  couponBatchSchema,
  couponCodeSchema,
  couponCodeSourceSchema,
  type CouponBatchRequest,
  type CouponCodeSource,
  type CouponTemplate,
} from "@/lib/config/coupons";
import {
  checkCodePattern,
  parseCodeList,
  type CouponCodePattern,
  type CouponPatternProblem,
  type ParsedCodeList,
} from "@/lib/domain/vouchers/coupon-codes";
import { formatAed } from "@/components/shared/money";
import {
  NEW_COUPON_TERMS,
  templateFromTerms,
  termsIssue,
  type CouponAddonOption,
  type CouponTermsDraft,
  type CouponTermsField,
} from "@/components/console/manage/coupons/coupon-terms-model";

export type CouponQuantity = "single" | "several";

export type CouponNaming = "random" | "list";

export interface CouponCreateDraft {
  readonly quantity: CouponQuantity;
  readonly naming: CouponNaming;
  readonly count: string;
  readonly prefix: string;
  readonly brandName: string;
  readonly brandNumber: string;
  readonly randomLength: number;
  readonly singleCode: string;
  readonly codeList: string;
  readonly batchName: string;
  readonly terms: CouponTermsDraft;
}

export const NEW_COUPON_BATCH: CouponCreateDraft = {
  quantity: "single",
  naming: "random",
  count: "",
  prefix: "",
  brandName: "",
  brandNumber: "",
  randomLength: COUPON_GENERATION.randomLengthDefault,
  singleCode: "",
  codeList: "",
  batchName: "",
  terms: NEW_COUPON_TERMS,
};

export type CouponCreateField = CouponTermsField | "count" | "pattern" | "singleCode" | "codeList";

export interface CouponCreateProblem {
  readonly field: CouponCreateField | null;
  readonly message: string;
}

export type CouponCreatePlan =
  | { readonly ok: true; readonly count: number; readonly request: CouponBatchRequest }
  | { readonly ok: false; readonly count: number | null; readonly problem: CouponCreateProblem };

type SourceResult =
  | { readonly ok: true; readonly source: CouponCodeSource }
  | { readonly ok: false; readonly problem: CouponCreateProblem };

export const COUPON_COUNT_MESSAGE = `Enter a number of coupons from 1 to ${COUPON_GENERATION.batchMax.toLocaleString("en-AE")}.`;

export function couponCount(draft: Pick<CouponCreateDraft, "quantity" | "count">): number | null {
  if (draft.quantity === "single") return 1;
  const raw = draft.count.trim();
  if (!/^\d+$/.test(raw)) return null;
  const count = Number(raw);
  return Number.isSafeInteger(count) && count >= 1 && count <= COUPON_GENERATION.batchMax ? count : null;
}

export function previewUses(count: number, maxUses: number | null): number {
  return count * (maxUses ?? 1);
}

export function codePattern(
  draft: Pick<CouponCreateDraft, "prefix" | "brandName" | "brandNumber" | "randomLength">,
): CouponCodePattern {
  return {
    prefix: draft.prefix,
    brandName: draft.brandName,
    brandNumber: draft.brandNumber,
    randomLength: draft.randomLength,
  };
}

export function patternProblem(draft: CouponCreateDraft): CouponPatternProblem | null {
  return checkCodePattern(codePattern(draft), couponCount(draft) ?? 1, COUPON_CODE_RULES);
}

export function parsedCodeList(draft: Pick<CouponCreateDraft, "codeList">): ParsedCodeList {
  return parseCodeList(draft.codeList, COUPON_CODE_RULES);
}

export function singleCodeMessage(code: string): string | null {
  if (code.trim() === "") return null;
  const parsed = couponCodeSchema.safeParse(code);
  return parsed.success ? null : parsed.error.issues[0].message;
}

export function draftCodes(draft: CouponCreateDraft): readonly string[] {
  if (draft.naming === "random") return [];
  if (draft.quantity === "single") {
    const parsed = couponCodeSchema.safeParse(draft.singleCode);
    return parsed.success ? [parsed.data] : [];
  }
  return parsedCodeList(draft).codes;
}

export function codesInUse(draft: CouponCreateDraft, conflicts: readonly string[]): readonly string[] {
  const current = new Set(draftCodes(draft));
  return conflicts.filter((code) => current.has(code));
}

function codeField(draft: CouponCreateDraft): CouponCreateField {
  if (draft.naming === "random") return "pattern";
  return draft.quantity === "single" ? "singleCode" : "codeList";
}

function codeSource(draft: CouponCreateDraft, count: number): SourceResult {
  const field = codeField(draft);

  if (draft.naming === "random") {
    const problem = patternProblem(draft);
    if (problem !== null) return { ok: false, problem: { field, message: COUPON_PATTERN_MESSAGE[problem] } };
    return {
      ok: true,
      source: {
        mode: "random",
        count,
        prefix: draft.prefix,
        brandName: draft.brandName,
        brandNumber: draft.brandNumber,
        randomLength: draft.randomLength,
      },
    };
  }

  if (draft.quantity === "single") {
    if (draft.singleCode.trim() === "") return { ok: false, problem: { field, message: "Enter a coupon code." } };
    const message = singleCodeMessage(draft.singleCode);
    if (message !== null) return { ok: false, problem: { field, message } };
    return { ok: true, source: { mode: "list", codes: [...draftCodes(draft)] } };
  }

  const list = parsedCodeList(draft);
  if (list.invalid.length > 0) {
    return { ok: false, problem: { field, message: "Correct or remove the codes that are not valid." } };
  }
  if (list.codes.length === 0) return { ok: false, problem: { field, message: "Enter at least one coupon code." } };
  return { ok: true, source: { mode: "list", codes: [...list.codes] } };
}

export function planCouponBatch(draft: CouponCreateDraft, conflicts: readonly string[] = []): CouponCreatePlan {
  const listed = draft.naming === "list" && draft.quantity === "several" ? parsedCodeList(draft).codes.length : null;
  const count = listed ?? couponCount(draft);

  if (count === null) return { ok: false, count, problem: { field: "count", message: COUPON_COUNT_MESSAGE } };

  const built = codeSource(draft, count);
  if (!built.ok) return { ok: false, count, problem: built.problem };

  const source = couponCodeSourceSchema.safeParse(built.source);
  if (!source.success) {
    return { ok: false, count, problem: { field: codeField(draft), message: source.error.issues[0].message } };
  }

  if (codesInUse(draft, conflicts).length > 0) {
    return { ok: false, count, problem: { field: codeField(draft), message: "Change or remove the codes already in use." } };
  }

  const terms = termsIssue(draft.terms);
  if (terms !== null) return { ok: false, count, problem: terms };

  const batchName = draft.quantity === "several" && draft.batchName.trim() !== "" ? draft.batchName.trim() : null;
  const parsed = couponBatchSchema.safeParse({
    template: templateFromTerms(draft.terms),
    source: source.data,
    batchName,
  });
  if (!parsed.success) return { ok: false, count, problem: { field: null, message: parsed.error.issues[0].message } };

  return { ok: true, count, request: parsed.data };
}

export function createLabel(count: number | null): string {
  if (count === null || count < 1) return "Create coupons";
  if (count === 1) return "Create coupon";
  return `Create ${count.toLocaleString("en-AE")} coupons`;
}

export function listFormat(values: readonly string[]): string {
  return new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(values);
}

export function addonNames(addonIds: readonly string[], addons: readonly CouponAddonOption[] | null): string[] {
  return addonIds.map((id) => addons?.find((addon) => addon.id === id)?.name ?? "Add-on no longer listed");
}

export function couponDiscountText(template: CouponTemplate, addons: readonly CouponAddonOption[] | null): string {
  if (template.kind === "fixed") return formatAed(template.amountFils ?? 0);
  if (template.kind === "percent") return `${template.percent ?? 0}%`;
  const names = addonNames(template.addonIds, addons);
  return names.length > 0 ? `Free ${listFormat(names)}` : "Free add-ons";
}

export const COUPON_CSV_COLUMNS = ["Code", "Discount", "Valid from", "Expiry", "Batch"] as const;

function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `\t${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export interface CreatedCouponBatch {
  readonly codes: readonly string[];
  readonly template: CouponTemplate;
  readonly batchName: string | null;
}

export function couponsCsv(batch: CreatedCouponBatch, addons: readonly CouponAddonOption[] | null): string {
  const discount = couponDiscountText(batch.template, addons);
  const validFrom = batch.template.validFrom ?? "Immediately";
  const expiry = batch.template.validTo ?? "No expiry";
  const rows: readonly (readonly string[])[] = [
    COUPON_CSV_COLUMNS,
    ...batch.codes.map((code) => [code, discount, validFrom, expiry, batch.batchName ?? ""]),
  ];
  return `\u{FEFF}${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;
}

export function couponsCsvFilename(today: string, batchName: string | null): string {
  const slug = (batchName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? `wellplace-coupons-${today}.csv` : `wellplace-coupons-${slug}-${today}.csv`;
}
