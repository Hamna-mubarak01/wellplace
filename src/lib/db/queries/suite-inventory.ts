import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import { SUITE_STATUSES } from "@/lib/config/suite-status";

const suiteRowSchema = z.object({
  id: z.uuid(), suite_number: z.number().int(), display_name: z.string().nullable(),
  status: z.enum(SUITE_STATUSES),
  priority: z.number().int(), internal_note: z.string().nullable(),
  bookings_today: z.number().int(), holds_today: z.number().int(),
  next_booking_at: z.string().nullable(), current_state: z.string().nullable(),
  is_active: z.boolean(), retired_at: z.string().nullable(), retirement_reason: z.string().nullable(),
  retired_by_name: z.string().nullable(), has_history: z.boolean(), upcoming_bookings: z.number().int(),
});
const inventorySchema = z.array(suiteRowSchema);
const INVENTORY_COLUMNS =
  "id,suite_number,display_name,status,bookings_today,holds_today,next_booking_at,current_state,priority,internal_note,is_active,retired_at,retirement_reason,retired_by_name,has_history,upcoming_bookings";
export interface ManagedSuite {
  id: string;
  suiteNumber: number;
  displayName: string | null;
  status: z.infer<typeof inventorySchema>[number]["status"];
  priority: number;
  internalNote: string | null;
  bookingsToday: number;
  holdsToday: number;
  nextBookingAt: string | null;
  currentState: string | null;
  isActive: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  retiredByName: string | null;
  hasHistory: boolean;
  upcomingBookings: number;
}
export type SuiteInventory = { ok: true; suites: ManagedSuite[] } | { ok: false; message: string };

function toManagedSuite(s: z.infer<typeof suiteRowSchema>): ManagedSuite {
  return { id: s.id, suiteNumber: s.suite_number,
    displayName: s.display_name, status: s.status, priority: s.priority, internalNote: s.internal_note,
    bookingsToday: s.bookings_today, holdsToday: s.holds_today,
    nextBookingAt: s.next_booking_at, currentState: s.current_state,
    isActive: s.is_active, retiredAt: s.retired_at, retirementReason: s.retirement_reason,
    retiredByName: s.retired_by_name, hasHistory: s.has_history, upcomingBookings: s.upcoming_bookings };
}

export async function listSuiteInventory(client: WellPlaceClient): Promise<SuiteInventory> {
  const { data, error } = await client.from("management_suite_inventory")
    .select(INVENTORY_COLUMNS)
    .order("suite_number");
  const parsed = inventorySchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("[db] suite inventory unavailable:", error?.message ?? parsed.error?.message);
    return { ok: false, message: "Suite information could not be loaded. Please try again." };
  }
  return { ok: true, suites: parsed.data.map(toManagedSuite) };
}

export type ManagedSuiteLookup =
  | { outcome: "found"; suite: ManagedSuite }
  | { outcome: "not_found" }
  | { outcome: "failed"; message: string };

export async function findManagedSuite(client: WellPlaceClient, id: string): Promise<ManagedSuiteLookup> {
  const { data, error } = await client.from("management_suite_inventory")
    .select(INVENTORY_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[db] suite detail unavailable:", error.message);
    return { outcome: "failed", message: "Suite information could not be loaded. Please try again." };
  }
  if (data === null) return { outcome: "not_found" };
  const parsed = suiteRowSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[db] suite detail returned an unexpected row:", parsed.error.issues[0]?.message);
    return { outcome: "failed", message: "Suite information could not be loaded. Please try again." };
  }
  return { outcome: "found", suite: toManagedSuite(parsed.data) };
}
