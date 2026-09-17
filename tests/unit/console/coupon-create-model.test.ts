import { describe, expect, it } from "vitest";

import {
  COUPON_COUNT_MESSAGE,
  COUPON_CSV_COLUMNS,
  NEW_COUPON_BATCH,
  codesInUse,
  couponCount,
  couponDiscountText,
  couponsCsv,
  couponsCsvFilename,
  createLabel,
  planCouponBatch,
  previewUses,
  type CouponCreateDraft,
} from "@/components/console/manage/coupons/coupon-create-model";
import {
  NEW_COUPON_TERMS,
  previewRequestFromTerms,
  templateFromTerms,
  termsFromCoupon,
  termsIssue,
} from "@/components/console/manage/coupons/coupon-terms-model";
import {
  COUPON_GENERATION,
  COUPON_PATTERN_MESSAGE,
  type CouponRow,
  type CouponTemplate,
} from "@/lib/config/coupons";

const TOWEL = "00000000-0000-4000-8000-0000000000a1";
const ROBE = "00000000-0000-4000-8000-0000000000a2";
const ADDONS = [
  { id: TOWEL, name: "Towel" },
  { id: ROBE, name: "Bathrobe" },
];

function draft(patch: Partial<CouponCreateDraft>, terms: Partial<CouponCreateDraft["terms"]> = {}): CouponCreateDraft {
  return { ...NEW_COUPON_BATCH, ...patch, terms: { ...NEW_COUPON_BATCH.terms, value: "10", ...terms } };
}

function template(patch: Partial<CouponTemplate>): CouponTemplate {
  return { ...templateFromTerms({ ...NEW_COUPON_TERMS, value: "10" }), ...patch };
}

describe("[CLIENT coupon request] coupon discount fields", () => {
  it("turns the typed discount into the saved shape for each discount type", () => {
    expect(templateFromTerms({ ...NEW_COUPON_TERMS, kind: "fixed", value: "50.5" })).toMatchObject({
      kind: "fixed",
      amountFils: 5050,
      percent: null,
      addonIds: [],
    });
    expect(templateFromTerms({ ...NEW_COUPON_TERMS, kind: "percent", value: "12.5" })).toMatchObject({
      amountFils: null,
      percent: 12.5,
    });
    expect(
      templateFromTerms({ ...NEW_COUPON_TERMS, kind: "addon_free", value: "10", addonIds: [TOWEL] }),
    ).toMatchObject({ amountFils: null, percent: null, addonIds: [TOWEL] });
  });

  it("names the field and the fix when the discount is missing or out of range", () => {
    expect(termsIssue(NEW_COUPON_TERMS)).toEqual({
      field: "value",
      message: "Enter a percentage above zero and no more than 100.",
    });
    expect(termsIssue({ ...NEW_COUPON_TERMS, value: "." })?.field).toBe("value");
    expect(termsIssue({ ...NEW_COUPON_TERMS, kind: "addon_free" })?.field).toBe("addonIds");
    expect(
      termsIssue({ ...NEW_COUPON_TERMS, value: "10", validFrom: "2026-09-20", validTo: "2026-09-10" })?.field,
    ).toBe("validTo");
    expect(termsIssue({ ...NEW_COUPON_TERMS, value: "10", maxUses: 0 })?.field).toBe("maxUses");
    expect(termsIssue({ ...NEW_COUPON_TERMS, value: "10" })).toBeNull();
  });

  it("round-trips an existing coupon into the edit fields", () => {
    const row: CouponRow = {
      id: "00000000-0000-4000-8000-000000000001",
      updatedAt: null,
      code: "USED-ONE",
      kind: "fixed",
      amountFils: 2500,
      percent: null,
      addonIds: [],
      validFrom: "2026-09-01",
      validTo: null,
      maxUses: 5,
      perCustomerLimit: null,
      isCombinable: false,
      isActive: true,
      usedCount: 3,
      batchId: null,
      batchName: null,
    };
    const terms = termsFromCoupon(row);
    expect(terms.value).toBe("25.00");
    expect(templateFromTerms(terms)).toEqual({
      kind: "fixed",
      amountFils: 2500,
      percent: null,
      addonIds: [],
      validFrom: "2026-09-01",
      validTo: null,
      maxUses: 5,
      perCustomerLimit: null,
      isCombinable: false,
      isActive: true,
    });
  });
});

describe("[CLIENT coupon request] expected income request", () => {
  it("uses one booking per coupon, times the uses each coupon allows", () => {
    expect(previewUses(1, null)).toBe(1);
    expect(previewUses(1, 5)).toBe(5);
    expect(previewUses(50, null)).toBe(50);
    expect(previewUses(50, 3)).toBe(150);
  });

  it("asks for a preview only once the discount is complete", () => {
    expect(previewRequestFromTerms(NEW_COUPON_TERMS, 1)).toBeNull();
    expect(previewRequestFromTerms({ ...NEW_COUPON_TERMS, kind: "addon_free" }, 1)).toBeNull();
    expect(previewRequestFromTerms({ ...NEW_COUPON_TERMS, value: "15", maxUses: 0 }, 4)).toEqual({
      kind: "percent",
      amountFils: null,
      percent: 15,
      addonIds: [],
      uses: 4,
    });
    expect(previewRequestFromTerms({ ...NEW_COUPON_TERMS, kind: "addon_free", addonIds: [ROBE] }, 2)).toEqual({
      kind: "addon_free",
      amountFils: null,
      percent: null,
      addonIds: [ROBE],
      uses: 2,
    });
  });
});

describe("[CLIENT coupon request] creating one or many coupons", () => {
  it("counts one coupon in single mode and reads the number in several mode", () => {
    expect(couponCount({ quantity: "single", count: "" })).toBe(1);
    expect(couponCount({ quantity: "several", count: "25" })).toBe(25);
    expect(couponCount({ quantity: "several", count: "" })).toBeNull();
    expect(couponCount({ quantity: "several", count: "0" })).toBeNull();
    expect(couponCount({ quantity: "several", count: "2.5" })).toBeNull();
    expect(couponCount({ quantity: "several", count: String(COUPON_GENERATION.batchMax + 1) })).toBeNull();
    expect(couponCount({ quantity: "several", count: String(COUPON_GENERATION.batchMax) })).toBe(
      COUPON_GENERATION.batchMax,
    );
  });

  it("builds a random batch with the manager's prefix, brand and length", () => {
    const plan = planCouponBatch(
      draft({ quantity: "several", count: "20", prefix: "wp", brandName: "Summer", brandNumber: "25", batchName: "  Launch  " }),
    );
    expect(plan).toMatchObject({
      ok: true,
      count: 20,
      request: {
        source: {
          mode: "random",
          count: 20,
          prefix: "wp",
          brandName: "Summer",
          brandNumber: "25",
          randomLength: COUPON_GENERATION.randomLengthDefault,
        },
        batchName: "Launch",
        template: { kind: "percent", percent: 10 },
      },
    });
  });

  it("never sends a batch name for a single coupon", () => {
    const plan = planCouponBatch(draft({ batchName: "Ignored" }));
    expect(plan.ok && plan.request.batchName).toBeNull();
  });

  it("stops a random pattern that cannot produce valid codes", () => {
    const plan = planCouponBatch(
      draft({ prefix: "P".repeat(16), brandName: "B".repeat(16), brandNumber: "1234567", randomLength: 12 }),
    );
    expect(plan).toMatchObject({
      ok: false,
      problem: { field: "pattern", message: COUPON_PATTERN_MESSAGE.code_too_long },
    });
  });

  it("asks for the number of coupons before anything else in several mode", () => {
    expect(planCouponBatch(draft({ quantity: "several", count: "" }))).toMatchObject({
      ok: false,
      count: null,
      problem: { field: "count", message: COUPON_COUNT_MESSAGE },
    });
  });

  it("creates a single coupon under the manager's own name", () => {
    expect(planCouponBatch(draft({ naming: "list", singleCode: " vip-2026 " }))).toMatchObject({
      ok: true,
      count: 1,
      request: { source: { mode: "list", codes: ["VIP-2026"] } },
    });
    expect(planCouponBatch(draft({ naming: "list", singleCode: "" }))).toMatchObject({
      ok: false,
      problem: { field: "singleCode", message: "Enter a coupon code." },
    });
    expect(planCouponBatch(draft({ naming: "list", singleCode: "A B" }))).toMatchObject({
      ok: false,
      problem: { field: "singleCode" },
    });
  });

  it("takes the count from the manager's list, and refuses invalid entries", () => {
    expect(planCouponBatch(draft({ quantity: "several", naming: "list", codeList: "alpha, beta\ngamma alpha" }))).toMatchObject({
      ok: true,
      count: 3,
      request: { source: { mode: "list", codes: ["ALPHA", "BETA", "GAMMA"] } },
    });
    expect(planCouponBatch(draft({ quantity: "several", naming: "list", codeList: "alpha x" }))).toMatchObject({
      ok: false,
      count: 1,
      problem: { field: "codeList", message: "Correct or remove the codes that are not valid." },
    });
    expect(planCouponBatch(draft({ quantity: "several", naming: "list", codeList: "  " }))).toMatchObject({
      ok: false,
      problem: { field: "codeList", message: "Enter at least one coupon code." },
    });
  });

  it("refuses a list longer than one batch", () => {
    const codes = Array.from({ length: COUPON_GENERATION.batchMax + 1 }, (_, index) => `CODE${index}`).join("\n");
    expect(planCouponBatch(draft({ quantity: "several", naming: "list", codeList: codes }))).toMatchObject({
      ok: false,
      count: COUPON_GENERATION.batchMax + 1,
      problem: { field: "codeList" },
    });
  });

  it("blocks codes already in use until they are changed or removed", () => {
    const listed = draft({ quantity: "several", naming: "list", codeList: "ALPHA BETA" });
    expect(codesInUse(listed, ["BETA", "OMEGA"])).toEqual(["BETA"]);
    expect(planCouponBatch(listed, ["BETA"])).toMatchObject({
      ok: false,
      problem: { field: "codeList", message: "Change or remove the codes already in use." },
    });
    expect(planCouponBatch({ ...listed, codeList: "ALPHA GAMMA" }, ["BETA"]).ok).toBe(true);
    expect(codesInUse(draft({}), ["BETA"])).toEqual([]);
  });

  it("checks the discount after the codes", () => {
    expect(planCouponBatch(draft({}, { value: "" }))).toMatchObject({
      ok: false,
      count: 1,
      problem: { field: "value" },
    });
  });

  it("labels the button with the number of coupons", () => {
    expect(createLabel(1)).toBe("Create coupon");
    expect(createLabel(20)).toBe("Create 20 coupons");
    expect(createLabel(null)).toBe("Create coupons");
    expect(createLabel(0)).toBe("Create coupons");
  });
});

describe("[CLIENT coupon request] created coupons download", () => {
  it("describes each discount type in words", () => {
    expect(couponDiscountText(template({ kind: "percent", percent: 12.5 }), ADDONS)).toBe("12.5%");
    expect(couponDiscountText(template({ kind: "fixed", amountFils: 5000, percent: null }), ADDONS)).toBe(
      "AED 50.00",
    );
    expect(
      couponDiscountText(template({ kind: "addon_free", percent: null, addonIds: [TOWEL, ROBE] }), ADDONS),
    ).toBe("Free Towel and Bathrobe");
  });

  it("writes one row per code with the columns the manager asked for", () => {
    const csv = couponsCsv(
      {
        codes: ["SUMMER-7KX9QA", "SUMMER-3HT4PL"],
        template: template({ validFrom: "2026-09-12", validTo: "2026-09-30" }),
        batchName: "Summer, \"launch\"",
      },
      ADDONS,
    );
    expect(csv.startsWith("\u{FEFF}")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      COUPON_CSV_COLUMNS.join(","),
      'SUMMER-7KX9QA,10%,2026-09-12,2026-09-30,"Summer, ""launch"""',
      'SUMMER-3HT4PL,10%,2026-09-12,2026-09-30,"Summer, ""launch"""',
      "",
    ]);
  });

  it("spells out open dates and guards against spreadsheet formulas", () => {
    const csv = couponsCsv({ codes: ["ONE"], template: template({}), batchName: "=HYPERLINK(1)" }, ADDONS);
    expect(csv.slice(1).split("\r\n")[1]).toBe("ONE,10%,Immediately,No expiry,\t=HYPERLINK(1)");
  });

  it("names the file after the batch and the day", () => {
    expect(couponsCsvFilename("2026-09-12", null)).toBe("wellplace-coupons-2026-09-12.csv");
    expect(couponsCsvFilename("2026-09-12", "  Summer Launch #1 ")).toBe(
      "wellplace-coupons-summer-launch-1-2026-09-12.csv",
    );
  });
});
