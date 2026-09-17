import { describe, expect, it, vi } from "vitest";
import { readManagementPayments } from "@/lib/db/queries/management-payments";
import { listBookingPayments } from "@/lib/db/queries/payments";
import type { WellPlaceClient } from "@/lib/db/types";

function clientReturning(data: unknown, error: unknown = null, refundResult: { data: unknown; error: unknown } = { data: null, error: null }) {
  const result = { data, error, count: Array.isArray(data) ? data.length : null };
  const query = { select: vi.fn(), order: vi.fn(), eq: vi.fn(), ilike: vi.fn(), range: vi.fn(async () => result), then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of [query.select, query.order, query.eq, query.ilike]) method.mockReturnValue(query);
  const rpc = vi.fn(async () => refundResult);
  return { client: { from: vi.fn(() => query), rpc } as unknown as WellPlaceClient, query, rpc };
}

const PAYMENT_ID = "10000000-0000-4000-8000-000000000001";
const PENDING_REFUND = { refund_id: "20000000-0000-4000-8000-000000000001", payment_id: PAYMENT_ID, amount_fils: 2000, is_pending: true, is_automatic: false, requested_at: "2026-09-10T06:00:00Z", withdrawn_at: null };

describe("[OUR CHOICE] Payment reads preserve financial uncertainty and refund limits", () => {
  it("reserves both pending and completed refund requests against the original payment", async () => {
    const { client } = clientReturning([{ id: "payment", booking_id: "booking", method: "card", status: "partially_refunded", amount_fils: 10000, recorded_at: "2026-09-10T06:00:00Z", bookings: { reference: "WP-123" }, refunds: [{ id: "refund-1", amount_fils: 2000, is_pending: true, settled_at: null, withdrawn_at: null }, { id: "refund-2", amount_fils: 3000, is_pending: false, settled_at: "2026-09-10T06:00:00Z", withdrawn_at: null }, { id: "refund-3", amount_fils: 4000, is_pending: true, settled_at: null, withdrawn_at: "2026-09-10T07:00:00Z" }] }]);
    const result = await readManagementPayments(client, 1, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payments[0]).toMatchObject({ requestedFils: 5000, pendingFils: 2000, remainingFils: 5000 });
  });
  it("limits booking refunds using all existing refund requests only when requested", async () => {
    const { client, rpc } = clientReturning([{ id: PAYMENT_ID, amount_fils: 10000 }], null, { data: [PENDING_REFUND, { ...PENDING_REFUND, refund_id: "20000000-0000-4000-8000-000000000002", amount_fils: 3000, is_pending: false }, { ...PENDING_REFUND, refund_id: "20000000-0000-4000-8000-000000000003", amount_fils: 4000, withdrawn_at: "2026-09-10T07:00:00Z" }], error: null });
    const visible = await listBookingPayments(client, "booking", true);
    expect(visible.ok && visible.payments[0].refundableFils).toBe(5000);
    expect(rpc).toHaveBeenCalledWith("booking_refunds", { p_booking_id: "booking" });
    expect(visible.ok && visible.payments[0].pendingRefunds).toEqual([{ id: PENDING_REFUND.refund_id, amountFils: 2000, requestedAt: PENDING_REFUND.requested_at, automatic: false }]);
    const hidden = await listBookingPayments(client, "booking");
    expect(hidden.ok && hidden.payments[0].refundableFils).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("does not offer a refund if the remaining balance cannot be established", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const refunds of [undefined, [{ ...PENDING_REFUND, amount_fils: "bad" }], [{ ...PENDING_REFUND, amount_fils: -1 }], [{ ...PENDING_REFUND, is_automatic: undefined }]]) {
      const { client } = clientReturning([{ id: PAYMENT_ID, amount_fils: 10000 }], null, { data: refunds, error: null });
      const result = await listBookingPayments(client, "booking", true);
      expect(result.ok && result.payments[0].refundableFils).toBeNull();
    }
  });
  it("shows a failed read instead of an empty history when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = clientReturning(null, { message: "database unavailable" });
    expect(await listBookingPayments(client, "booking")).toMatchObject({ ok: false, message: expect.stringContaining("before recording another payment") });
    expect(await readManagementPayments(client, 1, "")).toMatchObject({ ok: false });
  });
  it("rejects malformed Management results and escapes wildcard searches", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, query } = clientReturning([{ unexpected: true }]);
    expect(await readManagementPayments(client, 1, "WP_%")).toMatchObject({ ok: false });
    expect(query.ilike).toHaveBeenCalledWith("bookings.reference", "%WP\\_\\%%");
  });
});
