import { beforeEach, describe, expect, it, vi } from "vitest";
import { quoteReceptionInput } from "@/lib/validation/reception-action-inputs";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireReception: mocks.guard, requireManagement: mocks.guard, hasPermission: () => true }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { assignCleaning, assignTask, cancelBooking, checkIn, checkOut, handOverShift, markNoShow, quoteWalkIn, recordArrival, startCleaning, takeCleaningTask, voidPayment } from "@/app/(console)/reception/actions";

const id = "7e2e0001-0000-4000-8000-000000000001";
const quote = { startsAt: "2026-09-12T06:00:00Z", durationHours: 2, adults: 2, childAges: [], customerId: null, addonQuantities: {}, voucherCode: null };

describe("[§9.2; user direction] Reception rejects malformed actions before database access", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.guard.mockResolvedValue({ userId: id, role: "reception" }); });
  it.each([
    () => cancelBooking("bad-id", "Guest request"),
    () => cancelBooking(id, "   "),
    () => markNoShow("bad-id", "Guest did not arrive"),
    () => recordArrival("bad-id", ""),
    () => checkIn("bad-id", ""),
    () => checkOut("bad-id", ""),
    () => startCleaning("bad-id"),
    () => takeCleaningTask("bad-id"),
    () => assignCleaning(id, "bad-id"),
    () => assignTask("bad-id", null),
    () => handOverShift("bad-id"),
    () => quoteWalkIn({ ...quote, durationHours: -1 }),
    () => voidPayment({ bookingId: id, paymentId: "bad-id", reason: "Duplicate" }),
  ])("returns an explanation without opening a database connection (%#)", async (perform) => {
    expect(await perform()).toMatchObject({ ok: false, message: expect.any(String) });
    expect(mocks.guard).toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("checks access before validating a request", async () => {
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(quoteWalkIn(quote)).rejects.toThrow("Access denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("allows removing an extra and rejects negative or fractional quantities and invalid child ages", () => {
    expect(quoteReceptionInput.safeParse({ ...quote, addonQuantities: { [id]: 0 } }).success).toBe(true);
    for (const quantity of [-1, 0.5, Infinity, NaN]) expect(quoteReceptionInput.safeParse({ ...quote, addonQuantities: { [id]: quantity } }).success).toBe(false);
    expect(quoteReceptionInput.safeParse({ ...quote, childAges: [-1] }).success).toBe(false);
    expect(quoteReceptionInput.safeParse({ ...quote, customerId: "bad-id" }).success).toBe(false);
  });
});
