import type { StaffFilters } from "@/lib/console/staff-filters";

export const STAFF_PATH = "/manage/staff";

export type StaffFilterPatch = Readonly<Partial<Record<"q" | "role" | "access", string | null>>>;

export function staffHref(filters: StaffFilters, patch: StaffFilterPatch): string {
  const next = new URLSearchParams();
  const current: Record<"q" | "role" | "access", string | null> = {
    q: filters.search === "" ? null : filters.search,
    role: filters.role === "any" ? null : filters.role,
    access: filters.access === "any" ? null : filters.access,
  };

  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value !== null && value !== undefined && value !== "") next.set(key, value);
  }

  const query = next.toString();
  return query ? `${STAFF_PATH}?${query}` : STAFF_PATH;
}
