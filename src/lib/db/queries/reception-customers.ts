import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type ReceptionCustomer = Database["public"]["Functions"]["reception_customers"]["Returns"][number];
export type ReceptionSuiteChoice = Database["public"]["Functions"]["reception_booking_suites"]["Returns"][number];

export async function readReceptionCustomers(client: WellPlaceClient, search: string, id?: string) {
  const { data, error } = await client.rpc("reception_customers", { p_search: search, ...(id ? { p_id: id } : {}) });
  if (error) return { ok: false as const, message: "Customers could not be loaded. Try again." };
  return { ok: true as const, customers: data };
}

export async function readReceptionSuiteChoices(client: WellPlaceClient, startsAt: string, durationHours: number) {
  const { data, error } = await client.rpc("reception_booking_suites", { p_starts_at: startsAt, p_duration_hours: durationHours });
  if (error) return { ok: false as const, message: "Suite availability could not be loaded. Try again." };
  return { ok: true as const, suites: data };
}
