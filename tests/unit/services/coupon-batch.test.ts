import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ generateCoupons: vi.fn() }));
vi.mock("@/lib/db/coupons", () => db);

import { COUPON_GENERATION, type CouponBatchRequest, type CouponTemplate } from "@/lib/config/coupons";
import type { WellPlaceClient } from "@/lib/db/types";
import type { RandomIndex } from "@/lib/domain/vouchers/coupon-codes";
import { createCouponBatch, repeatedCodes } from "@/lib/services/coupon-batch-service";

const client = {} as WellPlaceClient;

const template: CouponTemplate = {
  kind: "percent",
  amountFils: null,
  percent: 10,
  addonIds: [],
  validFrom: null,
  validTo: "2026-12-31",
  maxUses: 1,
  perCustomerLimit: 1,
  isCombinable: true,
  isActive: true,
};

const counting = (): RandomIndex => {
  let next = 0;
  return (maxExclusive) => next++ % maxExclusive;
};

const random = (count: number): CouponBatchRequest => ({
  template,
  source: { mode: "random", count, prefix: "EID", brandName: "", brandNumber: "", randomLength: 4 },
  batchName: "Eid 2026",
});

type Written = { readonly codes: readonly string[]; readonly batchName: string | null; readonly reason: string };

const written = (): Written[] => db.generateCoupons.mock.calls.map(([, input]) => input as Written);

const created = (codes: readonly string[]) => ({
  ok: true as const,
  batchId: "batch",
  coupons: codes.map((code, index) => ({ id: `id-${index}`, code })),
});

beforeEach(() => {
  db.generateCoupons.mockReset();
});

describe("[CLIENT coupon request 2026-09-12] random coupons are created in one batch", () => {
  it("creates the number asked for in one call, with the pattern, the batch name and a console reason", async () => {
    db.generateCoupons.mockImplementation(async (_client: unknown, input: Written) => created(input.codes));

    const result = await createCouponBatch(client, random(3), counting());

    expect(result.ok).toBe(true);
    expect(written()).toHaveLength(1);
    const [call] = written();
    expect(call.codes).toHaveLength(3);
    expect(call.codes.every((code) => /^EID-[A-Z0-9]{4}$/.test(code))).toBe(true);
    expect(call.batchName).toBe("Eid 2026");
    expect(call.reason).toBe("Coupon batch created from the console");
  });

  it("replaces only the codes that turned out to be taken, keeping the rest of the batch", async () => {
    db.generateCoupons
      .mockImplementationOnce(async (_client: unknown, input: Written) => ({
        ok: false as const,
        message: "Some of these codes already exist.",
        conflicts: [input.codes[1]],
      }))
      .mockImplementationOnce(async (_client: unknown, input: Written) => created(input.codes));

    const result = await createCouponBatch(client, random(3), counting());

    expect(result.ok).toBe(true);
    const [first, second] = written();
    expect(second.codes).toHaveLength(3);
    expect(second.codes).toContain(first.codes[0]);
    expect(second.codes).toContain(first.codes[2]);
    expect(second.codes).not.toContain(first.codes[1]);
  });

  it("stops after the configured number of retries instead of looping on a crowded pattern", async () => {
    db.generateCoupons.mockImplementation(async (_client: unknown, input: Written) => ({
      ok: false as const,
      message: "Some of these codes already exist.",
      conflicts: [input.codes[0]],
    }));

    const result = await createCouponBatch(client, random(2), counting());

    expect(result.ok).toBe(false);
    expect(written()).toHaveLength(COUPON_GENERATION.conflictRetries + 1);
  });

  it("returns any other refusal at once without retrying", async () => {
    db.generateCoupons.mockResolvedValue({ ok: false, message: "Only managers can create coupons.", conflicts: [] });

    const result = await createCouponBatch(client, random(2), counting());

    expect(result).toEqual({ ok: false, message: "Only managers can create coupons.", conflicts: [] });
    expect(written()).toHaveLength(1);
  });

  it("refuses a pattern that cannot produce valid codes before calling the database", async () => {
    const request = random(1);
    const tooLong: CouponBatchRequest = {
      ...request,
      source: { mode: "random", count: 1, prefix: "A".repeat(16), brandName: "B".repeat(16), brandNumber: "", randomLength: 8 },
    };

    const result = await createCouponBatch(client, tooLong, counting());

    expect(result.ok).toBe(false);
    expect(written()).toHaveLength(0);
  });

  it("records a single coupon with the singular reason and no batch name when none was given", async () => {
    db.generateCoupons.mockImplementation(async (_client: unknown, input: Written) => created(input.codes));

    await createCouponBatch(client, { ...random(1), batchName: "" }, counting());

    expect(written()[0].reason).toBe("Coupon created from the console");
    expect(written()[0].batchName).toBeNull();
  });
});

describe("[CLIENT coupon request 2026-09-12] managers may name the coupons themselves", () => {
  const list = (codes: string[]): CouponBatchRequest => ({ template, source: { mode: "list", codes }, batchName: null });

  it("sends the manager's own codes unchanged and never invents replacements", async () => {
    db.generateCoupons.mockResolvedValue({ ok: false, message: "Some of these codes already exist.", conflicts: ["VIP-2"] });

    const result = await createCouponBatch(client, list(["VIP-1", "VIP-2"]));

    expect(written()).toHaveLength(1);
    expect(written()[0].codes).toEqual(["VIP-1", "VIP-2"]);
    expect(result).toEqual({ ok: false, message: "Some of these codes already exist.", conflicts: ["VIP-2"] });
  });

  it("names repeated codes instead of sending them", async () => {
    const result = await createCouponBatch(client, list(["VIP-1", "VIP-2", "VIP-1"]));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.conflicts).toEqual(["VIP-1"]);
    expect(written()).toHaveLength(0);
    expect(repeatedCodes(["A", "B", "A", "A"])).toEqual(["A"]);
  });
});
