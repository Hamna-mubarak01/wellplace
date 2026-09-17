import { describe, expect, it } from "vitest";

import { COUPON_CODE_RULES, COUPON_GENERATION } from "@/lib/config/coupons";
import {
  checkCodePattern,
  fixedCodeSegments,
  generatePatternCodes,
  isValidCouponCode,
  normaliseCodeSegment,
  parseCodeList,
  patternCodeLength,
  type CouponCodePattern,
  type RandomIndex,
} from "@/lib/domain/vouchers/coupon-codes";

const pattern = (over: Partial<CouponCodePattern> = {}): CouponCodePattern => ({
  prefix: "",
  brandName: "",
  brandNumber: "",
  randomLength: COUPON_GENERATION.randomLengthDefault,
  ...over,
});

function seededIndex(seed: number): RandomIndex {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return Math.floor((state / 2 ** 32) * maxExclusive);
  };
}

const sequence = (values: readonly number[]): RandomIndex => {
  let position = 0;
  return () => values[position++ % values.length];
};

describe("[CLIENT coupon request 2026-09-12] generated coupon codes follow the manager's pattern", () => {
  it("joins prefix, brand name, brand number and the random part with single hyphens", () => {
    const result = generatePatternCodes(
      pattern({ prefix: "wp", brandName: "Spa Week", brandNumber: "07", randomLength: 4 }),
      1,
      COUPON_CODE_RULES,
      sequence([0, 1, 2, 3]),
    );

    expect(result).toEqual({ ok: true, codes: ["WP-SPA-WEEK-07-ACDE"] });
  });

  it("leaves out the parts the manager left blank", () => {
    expect(fixedCodeSegments(pattern({ brandName: "  ", brandNumber: "12" }))).toEqual(["12"]);

    const result = generatePatternCodes(pattern({ randomLength: 5 }), 1, COUPON_CODE_RULES, sequence([4]));
    expect(result).toEqual({ ok: true, codes: ["FFFFF"] });
  });

  it("draws the random part only from the unambiguous alphabet", () => {
    const result = generatePatternCodes(pattern({ randomLength: 12 }), 200, COUPON_CODE_RULES, seededIndex(7));
    if (!result.ok) throw new Error(result.problem);

    const allowed = new Set(COUPON_GENERATION.alphabet);
    for (const code of result.codes) {
      expect([...code].every((character) => allowed.has(character))).toBe(true);
      expect(code).not.toMatch(/[O0I1S5B8Z2]/);
    }
  });

  it("creates exactly the number asked for, with no repeats", () => {
    const result = generatePatternCodes(
      pattern({ prefix: "EID" }),
      COUPON_GENERATION.batchMax,
      COUPON_CODE_RULES,
      seededIndex(42),
    );
    if (!result.ok) throw new Error(result.problem);

    expect(result.codes).toHaveLength(COUPON_GENERATION.batchMax);
    expect(new Set(result.codes).size).toBe(COUPON_GENERATION.batchMax);
    expect(result.codes.every((code) => isValidCouponCode(code, COUPON_CODE_RULES))).toBe(true);
  });

  it("never returns a code that already exists", () => {
    const taken = new Set(["AAAA", "CCCC"]);
    const result = generatePatternCodes(
      pattern({ randomLength: 4 }),
      1,
      COUPON_CODE_RULES,
      sequence([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]),
      taken,
    );

    expect(result).toEqual({ ok: true, codes: ["DDDD"] });
  });

  it("gives up with a reason instead of looping forever when the random source cannot produce enough codes", () => {
    const result = generatePatternCodes(pattern({ randomLength: 4 }), 2, COUPON_CODE_RULES, () => 0);

    expect(result).toEqual({ ok: false, problem: "too_few_combinations" });
  });
});

describe("[CLIENT coupon request 2026-09-12] a pattern that cannot produce valid codes is refused before anything is generated", () => {
  it("refuses a random part shorter or longer than the configured bounds", () => {
    expect(checkCodePattern(pattern({ randomLength: COUPON_GENERATION.randomLengthMin - 1 }), 1, COUPON_CODE_RULES)).toBe(
      "random_part_too_short",
    );
    expect(checkCodePattern(pattern({ randomLength: COUPON_GENERATION.randomLengthMax + 1 }), 1, COUPON_CODE_RULES)).toBe(
      "random_part_too_long",
    );
  });

  it("refuses a pattern whose codes would exceed the code length limit", () => {
    const long = pattern({ prefix: "A".repeat(16), brandName: "B".repeat(16), randomLength: 8 });

    expect(patternCodeLength(long)).toBeGreaterThan(COUPON_CODE_RULES.maxLength);
    expect(checkCodePattern(long, 1, COUPON_CODE_RULES)).toBe("code_too_long");
  });

  it("refuses a batch too large for the random part, so guessable or colliding codes are never issued", () => {
    const rules = { ...COUPON_CODE_RULES, randomLengthMin: 1 };
    const combinations = COUPON_GENERATION.alphabet.length ** 2;
    const tooMany = Math.floor(combinations / COUPON_GENERATION.combinationsPerCode) + 1;

    const short = pattern({ prefix: "EID", randomLength: 2 });

    expect(checkCodePattern(short, tooMany, rules)).toBe("too_few_combinations");
    expect(checkCodePattern(short, tooMany - 1, rules)).toBeNull();
  });

  it("accepts the default pattern for the largest batch", () => {
    expect(checkCodePattern(pattern(), COUPON_GENERATION.batchMax, COUPON_CODE_RULES)).toBeNull();
  });
});

describe("[CLIENT coupon request 2026-09-12] managers can type their own coupon names instead of random ones", () => {
  it("normalises each name the way the database stores it", () => {
    expect(normaliseCodeSegment("  summer_10 ")).toBe("SUMMER-10");
    expect(normaliseCodeSegment("--vip--")).toBe("VIP");
  });

  it("splits a pasted list on new lines, commas, semicolons and spaces", () => {
    const parsed = parseCodeList("summer10, winter20;\nVIP-001\tvip-002", COUPON_CODE_RULES);

    expect(parsed.codes).toEqual(["SUMMER10", "WINTER20", "VIP-001", "VIP-002"]);
    expect(parsed.invalid).toEqual([]);
    expect(parsed.duplicates).toEqual([]);
  });

  it("reports names that are too short or too long rather than dropping them silently", () => {
    const parsed = parseCodeList(`ok1 ab ${"X".repeat(41)}`, COUPON_CODE_RULES);

    expect(parsed.codes).toEqual(["OK1"]);
    expect(parsed.invalid).toEqual(["ab", "X".repeat(41)]);
  });

  it("reports each repeated name once and keeps the first", () => {
    const parsed = parseCodeList("vip1 VIP1 vip1 other", COUPON_CODE_RULES);

    expect(parsed.codes).toEqual(["VIP1", "OTHER"]);
    expect(parsed.duplicates).toEqual(["VIP1"]);
  });

  it("returns nothing for an empty list", () => {
    expect(parseCodeList("  \n , ; ", COUPON_CODE_RULES)).toEqual({ codes: [], invalid: [], duplicates: [] });
  });
});
