import { describe, expect, it } from "vitest";

import type { StaffRow } from "@/lib/db/queries/staff";
import {
  filterStaff,
  hasStaffFilters,
  parseStaffAccessFilter,
  parseStaffRoleFilter,
} from "@/lib/console/staff-filters";

const MEMBERS: StaffRow[] = [
  {
    id: "8f80a15b-990d-4faa-8197-aa0c3da6a6c0",
    email: "amina@example.com",
    fullName: "Amina Haddad",
    role: "management",
    isActive: true,
    createdAt: "2026-08-29T18:36:00.000Z",
  },
  {
    id: "c4cc907d-6721-41e2-ab93-e7df615fd8cb",
    email: "reception@example.com",
    fullName: "Samir Khan",
    role: "reception",
    isActive: false,
    createdAt: "2026-08-30T16:55:00.000Z",
  },
];

describe("staff filters [§10.6]", () => {
  it("filters by search, role and access together", () => {
    expect(
      filterStaff(MEMBERS, {
        search: "samir",
        role: "reception",
        access: "deactivated",
      }),
    ).toEqual([MEMBERS[1]]);
  });

  it("matches email searches without case sensitivity", () => {
    expect(
      filterStaff(MEMBERS, {
        search: "AMINA@EXAMPLE",
        role: "any",
        access: "any",
      }),
    ).toEqual([MEMBERS[0]]);
  });

  it("falls back to the unfiltered values for unknown URL input", () => {
    expect(parseStaffRoleFilter("owner")).toBe("any");
    expect(parseStaffAccessFilter("locked")).toBe("any");
  });

  it("recognises when any filter narrows the export", () => {
    expect(
      hasStaffFilters({ search: "", role: "any", access: "any" }),
    ).toBe(false);
    expect(
      hasStaffFilters({ search: "Amina", role: "any", access: "any" }),
    ).toBe(true);
  });
});
