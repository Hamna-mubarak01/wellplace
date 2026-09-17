import { describe, expect, it } from "vitest";

import {
  couponBatchNames,
  couponCalendar,
  couponsHref,
  filterCoupons,
  isFiltered,
  parseCouponsQuery,
  withKnownBatch,
} from "@/app/(console)/manage/coupons/coupons-view";
import { COUPON_GENERATION, type CouponRow } from "@/lib/config/coupons";

function coupon(overrides: Partial<CouponRow>): CouponRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    updatedAt: "2026-09-01T08:00:00Z",
    code: "WELCOME10",
    kind: "percent",
    amountFils: null,
    percent: 10,
    addonIds: [],
    validFrom: null,
    validTo: null,
    maxUses: null,
    perCustomerLimit: 1,
    isCombinable: true,
    isActive: true,
    usedCount: 0,
    batchId: null,
    batchName: null,
    ...overrides,
  };
}

const calendar = couponCalendar("2026-09-12");

const rows: readonly CouponRow[] = [
  coupon({ code: "WELCOME10" }),
  coupon({ code: "SUMMER-7KX9QA", batchId: "b1", batchName: "Summer launch" }),
  coupon({ code: "SUMMER-3HT4PL", batchId: "b1", batchName: "Summer launch", kind: "fixed", amountFils: 5000, percent: null }),
  coupon({ code: "PARTNER-A", batchId: "b2", batchName: "partner 2" }),
  coupon({ code: "PARTNER-B", batchId: "b3", batchName: "Partner 10" }),
  coupon({ code: "ALSO-SUMMER", batchId: "b4", batchName: "Summer launch" }),
];

describe("[CLIENT coupon request] coupon list batch filter", () => {
  it("reads the batch from the URL, trimmed", () => {
    expect(parseCouponsQuery({}).batch).toBeNull();
    expect(parseCouponsQuery({ batch: "  Summer launch  " }).batch).toBe("Summer launch");
  });

  it("ignores an empty, repeated or oversized batch value", () => {
    expect(parseCouponsQuery({ batch: "   " }).batch).toBeNull();
    expect(parseCouponsQuery({ batch: ["Summer launch", "Other"] }).batch).toBeNull();
    expect(parseCouponsQuery({ batch: "x".repeat(COUPON_GENERATION.batchNameMax + 1) }).batch).toBeNull();
    expect(parseCouponsQuery({ batch: "x".repeat(COUPON_GENERATION.batchNameMax) }).batch).toHaveLength(
      COUPON_GENERATION.batchNameMax,
    );
  });

  it("lists each batch name once, in natural order, leaving out coupons with no batch", () => {
    expect(couponBatchNames(rows)).toEqual(["partner 2", "Partner 10", "Summer launch"]);
    expect(couponBatchNames([coupon({})])).toEqual([]);
  });

  it("keeps only the coupons of the chosen batch, across batches that share a name", () => {
    const query = parseCouponsQuery({ batch: "Summer launch" });
    expect(filterCoupons(rows, query, calendar).map((row) => row.code)).toEqual([
      "SUMMER-7KX9QA",
      "SUMMER-3HT4PL",
      "ALSO-SUMMER",
    ]);
  });

  it("combines the batch with the code search and the other filters", () => {
    expect(
      filterCoupons(rows, parseCouponsQuery({ batch: "Summer launch", q: "3ht" }), calendar).map((row) => row.code),
    ).toEqual(["SUMMER-3HT4PL"]);
    expect(
      filterCoupons(rows, parseCouponsQuery({ batch: "Summer launch", kind: "percent" }), calendar).map(
        (row) => row.code,
      ),
    ).toEqual(["SUMMER-7KX9QA", "ALSO-SUMMER"]);
  });

  it("keeps the code search working with no batch chosen", () => {
    expect(filterCoupons(rows, parseCouponsQuery({ q: "partner" }), calendar).map((row) => row.code)).toEqual([
      "PARTNER-A",
      "PARTNER-B",
    ]);
  });

  it("drops a batch that no longer exists instead of showing an empty list", () => {
    const names = couponBatchNames(rows);
    const unknown = withKnownBatch(parseCouponsQuery({ batch: "Deleted batch" }), names);
    expect(unknown.batch).toBeNull();
    expect(filterCoupons(rows, unknown, calendar)).toHaveLength(rows.length);

    const known = parseCouponsQuery({ batch: "Summer launch" });
    expect(withKnownBatch(known, names)).toBe(known);
  });

  it("counts a batch as a filter", () => {
    expect(isFiltered(parseCouponsQuery({}))).toBe(false);
    expect(isFiltered(parseCouponsQuery({ batch: "Summer launch" }))).toBe(true);
  });

  it("keeps the batch in page links and drops the page when the batch changes", () => {
    expect(couponsHref({ batch: "Summer launch", page: "3" }, { page: "2" })).toBe(
      "/manage/coupons?batch=Summer+launch&page=2",
    );
    expect(couponsHref({ batch: "Summer launch", page: "3" }, { batch: "partner 2" })).toBe(
      "/manage/coupons?batch=partner+2",
    );
  });
});
