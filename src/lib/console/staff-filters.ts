import type { StaffRow } from "@/lib/db/queries/staff";

export type StaffRoleFilter = "any" | "management" | "reception";
export type StaffAccessFilter = "any" | "active" | "deactivated";

export interface StaffFilters {
  search: string;
  role: StaffRoleFilter;
  access: StaffAccessFilter;
}

export function parseStaffRoleFilter(
  value: string | undefined,
): StaffRoleFilter {
  return value === "management" || value === "reception" ? value : "any";
}

export function parseStaffAccessFilter(
  value: string | undefined,
): StaffAccessFilter {
  return value === "active" || value === "deactivated" ? value : "any";
}

export function hasStaffFilters(filters: StaffFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.role !== "any" ||
    filters.access !== "any"
  );
}

export function filterStaff(
  members: readonly StaffRow[],
  filters: StaffFilters,
): StaffRow[] {
  const term = filters.search.trim().toLowerCase();

  return members.filter((member) => {
    if (filters.role !== "any" && member.role !== filters.role) return false;
    if (
      filters.access !== "any" &&
      member.isActive !== (filters.access === "active")
    ) {
      return false;
    }
    if (term.length === 0) return true;

    return (
      member.fullName.toLowerCase().includes(term) ||
      member.email.toLowerCase().includes(term)
    );
  });
}
