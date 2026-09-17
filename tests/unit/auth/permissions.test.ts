import { describe, expect, it } from "vitest";

import { hasPermission, type StaffSession } from "@/lib/auth/session";
import { PERMISSION_LABEL, ROLE_PERMISSIONS, heldByRole } from "@/lib/config/permissions";

function session(
  role: StaffSession["role"],
  permissions: StaffSession["permissions"] = [],
): StaffSession {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "someone@wellplace.example",
    fullName: "Someone",
    role,
    permissions,
  };
}

describe("hasPermission mirrors internal.has_permission", () => {
  it("gives reception exactly suite override and customer correction [Project owner's direction, 17 September 2026]", () => {
    expect(hasPermission(session("reception"), "view_confidential_figures")).toBe(false);
    expect(hasPermission(session("reception"), "override_suite_allocation")).toBe(true);
    expect(hasPermission(session("reception"), "manual_price_change")).toBe(false);
    expect(hasPermission(session("reception"), "correct_customer_record")).toBe(true);
  });

  it("gives management every named permission [OUR CHOICE]", () => {
    for (const permission of Object.keys(PERMISSION_LABEL) as (keyof typeof PERMISSION_LABEL)[]) {
      expect(hasPermission(session("management"), permission)).toBe(true);
    }
  });

  it("ignores a stored grant the role does not carry", () => {
    expect(hasPermission(session("reception", ["view_confidential_figures", "manual_price_change"]), "view_confidential_figures")).toBe(false);
    expect(hasPermission(session("reception", ["view_confidential_figures", "manual_price_change"]), "manual_price_change")).toBe(false);
  });

  it("agrees with the role table", () => {
    for (const role of ["reception", "management"] as const) {
      for (const permission of Object.keys(PERMISSION_LABEL) as (keyof typeof PERMISSION_LABEL)[]) {
        expect(heldByRole(permission, role)).toBe(ROLE_PERMISSIONS[role].includes(permission));
      }
    }
  });
});
