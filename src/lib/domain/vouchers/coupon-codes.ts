export interface CouponCodePattern {
  readonly prefix: string;
  readonly brandName: string;
  readonly brandNumber: string;
  readonly randomLength: number;
}

export interface CouponCodeRules {
  readonly alphabet: string;
  readonly minLength: number;
  readonly maxLength: number;
  readonly randomLengthMin: number;
  readonly randomLengthMax: number;
  readonly combinationsPerCode: number;
}

export type CouponPatternProblem =
  | "random_part_too_short"
  | "random_part_too_long"
  | "code_too_long"
  | "code_too_short"
  | "too_few_combinations";

export type RandomIndex = (maxExclusive: number) => number;

const CODE_SHAPE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

export function normaliseCodeSegment(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function fixedCodeSegments(pattern: CouponCodePattern): string[] {
  return [pattern.prefix, pattern.brandName, pattern.brandNumber].map(normaliseCodeSegment).filter(Boolean);
}

export function joinCodeParts(fixed: readonly string[], random: string): string {
  return [...fixed, random].filter(Boolean).join("-");
}

export function patternCodeLength(pattern: CouponCodePattern): number {
  return joinCodeParts(fixedCodeSegments(pattern), "X".repeat(Math.max(0, pattern.randomLength))).length;
}

export function checkCodePattern(pattern: CouponCodePattern, count: number, rules: CouponCodeRules): CouponPatternProblem | null {
  if (pattern.randomLength < rules.randomLengthMin) return "random_part_too_short";
  if (pattern.randomLength > rules.randomLengthMax) return "random_part_too_long";
  const length = patternCodeLength(pattern);
  if (length > rules.maxLength) return "code_too_long";
  if (length < rules.minLength) return "code_too_short";
  const combinations = rules.alphabet.length ** pattern.randomLength;
  if (combinations < count * rules.combinationsPerCode) return "too_few_combinations";
  return null;
}

export function randomSegment(length: number, alphabet: string, randomIndex: RandomIndex): string {
  let segment = "";
  for (let index = 0; index < length; index += 1) segment += alphabet[randomIndex(alphabet.length)];
  return segment;
}

export type GeneratedCodes =
  | { readonly ok: true; readonly codes: readonly string[] }
  | { readonly ok: false; readonly problem: CouponPatternProblem };

export function generatePatternCodes(
  pattern: CouponCodePattern,
  count: number,
  rules: CouponCodeRules,
  randomIndex: RandomIndex,
  taken: ReadonlySet<string> = new Set(),
): GeneratedCodes {
  const problem = checkCodePattern(pattern, count, rules);
  if (problem !== null) return { ok: false, problem };

  const fixed = fixedCodeSegments(pattern);
  const codes = new Set<string>();
  const attempts = count * rules.combinationsPerCode;

  for (let attempt = 0; codes.size < count && attempt < attempts; attempt += 1) {
    const code = joinCodeParts(fixed, randomSegment(pattern.randomLength, rules.alphabet, randomIndex));
    if (!taken.has(code)) codes.add(code);
  }

  return codes.size === count ? { ok: true, codes: [...codes] } : { ok: false, problem: "too_few_combinations" };
}

export interface ParsedCodeList {
  readonly codes: readonly string[];
  readonly invalid: readonly string[];
  readonly duplicates: readonly string[];
}

export function isValidCouponCode(code: string, rules: Pick<CouponCodeRules, "minLength" | "maxLength">): boolean {
  return code.length >= rules.minLength && code.length <= rules.maxLength && CODE_SHAPE.test(code);
}

export function parseCodeList(text: string, rules: Pick<CouponCodeRules, "minLength" | "maxLength">): ParsedCodeList {
  const codes: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/[\s,;]+/)) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const code = normaliseCodeSegment(trimmed);
    if (!isValidCouponCode(code, rules)) {
      invalid.push(trimmed);
      continue;
    }
    if (seen.has(code)) {
      if (!duplicates.includes(code)) duplicates.push(code);
      continue;
    }
    seen.add(code);
    codes.push(code);
  }

  return { codes, invalid, duplicates };
}
