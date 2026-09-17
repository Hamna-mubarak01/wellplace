import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { findStaffWithPermissions, listStaffWithPermissions } from "@/lib/db/queries/staff";
import type { Database } from "@/types/database.generated";

describe("[§10.6] single-request staff access", () => {
  it("reads role and explicit grants together without requesting the roster", async () => {
    const urls: URL[] = [];
    const client = createClient<Database>("http://staff-query.test", "test-key", {
      global: { fetch: async (input) => {
        urls.push(new URL(String(input)));
        return Response.json({ id: "staff-a", email: "desk@example.test", full_name: "Reception",
          role: "reception", is_active: true, created_at: "2026-09-10",
          staff_permissions: [{ permission: "override_suite_allocation" }] });
      } },
    });
    expect(await findStaffWithPermissions(client, "staff-a")).toMatchObject({
      id: "staff-a", role: "reception", permissions: ["override_suite_allocation"],
    });
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get("id")).toBe("eq.staff-a");
    expect(urls[0].searchParams.get("select")).toContain("staff_permissions_staff_id_fkey(permission)");
  });

  it("fails closed when the combined access read fails", async () => {
    const client = createClient<Database>("http://staff-query.test", "test-key", {
      global: { fetch: async () => Response.json({ message: "Unavailable" }, { status: 403 }) },
    });
    await expect(findStaffWithPermissions(client, "staff-a")).rejects.toThrow("access could not be read");
  });
});

describe("[OUR CHOICE; owner request 12 September 2026] Staff roster without per-person requests", () => {
  it("loads each person's own grants in one request, including accounts with no grants", async () => {
    const urls: URL[] = [];
    const client = createClient<Database>("http://staff-query.test", "test-key", {
      global: { fetch: async (input) => {
        urls.push(new URL(String(input)));
        return Response.json([
          { id: "a", email: "a@example.test", full_name: "A", role: "management", is_active: true, created_at: "2026-09-12", staff_permissions: [{ permission: "manual_price_change" }] },
          { id: "b", email: "b@example.test", full_name: "B", role: "reception", is_active: false, created_at: "2026-09-12", staff_permissions: [] },
        ]);
      } },
    });
    const result = await listStaffWithPermissions(client);
    expect(result).toMatchObject({ ok: true, items: [
      { id: "a", permissions: ["manual_price_change"] },
      { id: "b", isActive: false, permissions: [] },
    ] });
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get("order")).toBe("is_active.desc,full_name.asc");
    expect(urls[0].searchParams.get("select")).toContain("staff_permissions_staff_id_fkey(permission)");
  });

  it("keeps an unreadable roster distinct from accounts having no grants", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = createClient<Database>("http://staff-query.test", "test-key", {
      global: { fetch: async () => Response.json({ message: "Unavailable" }, { status: 403 }) },
    });
    expect(await listStaffWithPermissions(client)).toMatchObject({ ok: false });
  });
});
