import { randomInt } from "node:crypto";
import {
  COUPON_CODE_RULES,
  COUPON_GENERATION,
  COUPON_PATTERN_MESSAGE,
  type CouponBatchRequest,
} from "@/lib/config/coupons";
import { generateCoupons } from "@/lib/db/coupons";
import type { WellPlaceClient } from "@/lib/db/types";
import {
  generatePatternCodes,
  type CouponCodePattern,
  type RandomIndex,
} from "@/lib/domain/vouchers/coupon-codes";
import { consoleCreate } from "@/lib/validation/audit-reason";

export interface CreatedCoupon {
  readonly id: string;
  readonly code: string;
}

export type CouponBatchResult =
  | { readonly ok: true; readonly batchId: string | null; readonly coupons: readonly CreatedCoupon[] }
  | { readonly ok: false; readonly message: string; readonly conflicts: readonly string[] };

const secureIndex: RandomIndex = (maxExclusive) => randomInt(maxExclusive);

const RETRIES_EXHAUSTED =
  "Some generated codes were already in use and no unused replacements were found. Add more random characters and try again.";

const REPEATED_CODES = "Each code can be used only once. Remove the repeated codes and try again.";

export function repeatedCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) repeated.add(code);
    seen.add(code);
  }
  return [...repeated];
}

export async function createCouponBatch(
  client: WellPlaceClient,
  request: CouponBatchRequest,
  randomIndex: RandomIndex = secureIndex,
): Promise<CouponBatchResult> {
  const { template, source } = request;
  const requested = source.mode === "random" ? source.count : source.codes.length;
  const reason = consoleCreate(requested > 1 ? "Coupon batch" : "Coupon");
  const batchName = request.batchName !== null && request.batchName.length > 0 ? request.batchName : null;
  const write = (codes: readonly string[]) => generateCoupons(client, { template, codes, batchName, reason });

  if (source.mode === "list") {
    const repeated = repeatedCodes(source.codes);
    if (repeated.length > 0) return { ok: false, message: REPEATED_CODES, conflicts: repeated };
    return write(source.codes);
  }

  const pattern: CouponCodePattern = {
    prefix: source.prefix,
    brandName: source.brandName,
    brandNumber: source.brandNumber,
    randomLength: source.randomLength,
  };

  const first = generatePatternCodes(pattern, source.count, COUPON_CODE_RULES, randomIndex);
  if (!first.ok) return { ok: false, message: COUPON_PATTERN_MESSAGE[first.problem], conflicts: [] };

  const taken = new Set<string>();
  let codes = first.codes;

  for (let attempt = 0; ; attempt += 1) {
    const result = await write(codes);
    if (result.ok || result.conflicts.length === 0) return result;
    if (attempt >= COUPON_GENERATION.conflictRetries) return { ok: false, message: RETRIES_EXHAUSTED, conflicts: [] };

    for (const code of result.conflicts) taken.add(code);
    const kept = codes.filter((code) => !taken.has(code));
    const refill = generatePatternCodes(
      pattern,
      codes.length - kept.length,
      COUPON_CODE_RULES,
      randomIndex,
      new Set([...taken, ...kept]),
    );
    if (!refill.ok) return { ok: false, message: COUPON_PATTERN_MESSAGE[refill.problem], conflicts: [] };
    codes = [...kept, ...refill.codes];
  }
}
