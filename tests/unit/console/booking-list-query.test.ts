import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.generated";
import { listBookings } from "@/lib/db/queries/bookings";

function database(response: { error?: boolean } = {}) {
  const urls: URL[] = [];
  const client = createClient<Database>("http://booking-query.test", "test-key", { global: { fetch: async (input) => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify(response.error ? { message: "offline" } : []), { status: response.error ? 500 : 200, headers: { "Content-Type": "application/json", "Content-Range": "*/57" } });
  } } });
  return { client, urls };
}
describe("[CLIENT, §9.1] database booking filters", () => {
  it("sends combined filters and stable pagination to the database, with an exact total", async () => {
    const { client, urls } = database();
    const result = await listBookings(client, { search: "guest@example.test", status: "confirmed", source: "telephone", suiteId: "suite-a", withChildren: true, paymentStatus: "paid", arrival: "overdue", now: "2026-09-10T08:00:00Z", from: "2026-09-09T20:00:00Z", to: "2026-09-10T20:00:00Z", offset: 25, limit: 25 });
    expect(result.total).toBe(57);
    const params = urls[0].searchParams;
    expect(params.get("payment_status")).toBe("eq.paid");
    expect(params.get("arrived_at")).toBe("is.null");
    expect(params.get("checked_in_at")).toBe("is.null");
    expect(params.getAll("experience_from")).toEqual(["lt.2026-09-10T08:00:00Z", "lt.2026-09-10T20:00:00Z"]);
    expect(params.get("experience_to")).toBe("gt.2026-09-09T20:00:00Z");
    expect(params.get("order")).toBe("experience_from.desc,booking_id.asc");
    expect(params.get("offset")).toBe("25");
    expect(params.get("limit")).toBe("25");
    expect(params.get("or")).toContain("payment_reference.imatch.");
  });
  it("quotes punctuation and escapes wildcard characters in literal guest searches", async () => {
    const { client, urls } = database();
    const term = 'A, (guest) "quoted" 50%_ *';
    await listBookings(client, { search: term, offset: 0, limit: 25 });
    const filter = urls[0].searchParams.get("or")!;
    expect(filter).toContain('guest_name.imatch."');
    expect(filter).toContain('A,');
    expect(filter).toContain('50%_');
    expect(filter).not.toContain('guest_name.ilike.%');
  });
  it("uses chronological upcoming and reverse chronological past bounds", async () => {
    const { client, urls } = database();
    await listBookings(client, { startsAfter: "2026-09-10T08:00:00Z", ascending: true, offset: 0, limit: 25 });
    await listBookings(client, { endsBefore: "2026-09-10T08:00:00Z", offset: 0, limit: 25 });
    expect(urls[0].searchParams.get("experience_from")).toBe("gte.2026-09-10T08:00:00Z");
    expect(urls[0].searchParams.get("order")).toBe("experience_from.asc,booking_id.asc");
    expect(urls[1].searchParams.get("experience_to")).toBe("lte.2026-09-10T08:00:00Z");
  });
  it("recovers the count when a previously valid page has disappeared", async () => {
    const offsets: string[] = [];
    const client = createClient<Database>("http://booking-query.test", "test-key", { global: { fetch: async (input) => {
      const offset = new URL(String(input)).searchParams.get("offset") ?? "0";
      offsets.push(offset);
      return offset !== "0"
        ? new Response(JSON.stringify({ code: "PGRST103", message: "Range not satisfiable" }), { status: 416 })
        : new Response("[]", { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "*/12" } });
    } } });
    expect((await listBookings(client, { offset: 250, limit: 25 })).total).toBe(12);
    expect(offsets).toEqual(["250", "0"]);
  });
  it("never presents a database failure as zero bookings", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await expect(listBookings(database({ error: true }).client, { offset: 0, limit: 25 })).rejects.toThrow("Bookings could not be loaded"); } finally { log.mockRestore(); }
  });
});
