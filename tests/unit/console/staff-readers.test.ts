import { describe, expect, it, vi } from "vitest";
import { listStaff, listOpenInvitations } from "@/lib/db/queries/staff";
import type { WellPlaceClient } from "@/lib/db/types";

function returning(error: { message: string } | null): WellPlaceClient {
  const result = { data: error ? null : [], error };
  const query = { select: vi.fn(), order: vi.fn(), is: vi.fn(), then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
  for (const method of [query.select, query.order, query.is]) method.mockReturnValue(query);
  return { from: vi.fn(() => query) } as unknown as WellPlaceClient;
}

describe("[OUR CHOICE] Staff read failures cannot masquerade as an empty team or invitation list", () => {
  it("reports database failures before the UI permits another invitation or assignment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await listStaff(returning({ message: "unavailable" }))).toMatchObject({ ok: false, message: expect.stringContaining("before assigning work") });
    expect(await listOpenInvitations(returning({ message: "unavailable" }))).toMatchObject({ ok: false, message: expect.stringContaining("before sending another invitation") });
  });
  it("still represents a successful empty list as empty", async () => {
    expect(await listStaff(returning(null))).toEqual({ ok: true, items: [] });
    expect(await listOpenInvitations(returning(null))).toEqual({ ok: true, items: [] });
  });
});
