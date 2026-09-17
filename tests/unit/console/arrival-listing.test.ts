import { describe, expect, it, vi } from "vitest";
import { listArrivals } from "@/lib/db/queries/bookings";
import type { WellPlaceClient } from "@/lib/db/types";

function clientFor(result: unknown) {
  const query = { select: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue(result) };
  return { from: vi.fn().mockReturnValue(query) } as unknown as WellPlaceClient;
}

const window = { from: "2026-09-08T06:00:00Z", to: "2026-09-08T18:00:00Z" };

describe("arrival notification reads", () => {
  it("distinguishes unavailable data from a day with no arrivals", async () => {
    expect(await listArrivals(clientFor({ data: null, error: { message: "Offline" } }), window)).toEqual({ ok: false, message: "Offline" });
    expect(await listArrivals(clientFor({ data: [], error: null }), window)).toEqual({ ok: true, arrivals: [] });
  });
  it("keeps the identity and actual-arrival timestamp needed for new-arrival dots", async () => {
    const result = await listArrivals(clientFor({ data: [{ booking_id: "booking-a", reference: "WP-1", booking_status: "confirmed", experience_from: window.from, arrived_at: "2026-09-08T05:58:00Z" }], error: null }), window);
    expect(result.ok && result.arrivals[0]).toMatchObject({ id: "booking-a", arrivedAt: "2026-09-08T05:58:00Z" });
  });
});
