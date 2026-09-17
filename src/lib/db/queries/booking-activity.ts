import type { WellPlaceClient } from "@/lib/db/types";

export async function readBookingAudit(client: WellPlaceClient, id: string) {
  const { data, error } = await client.rpc("reception_booking_audit", { p_id: id });
  if (error) {
    console.error("[db] booking audit failed:", error.message);
    return { ok: false as const, message: "The booking history could not be loaded. Refresh to try again." };
  }
  return { ok: true as const, events: data };
}

export async function readBookingActivity(client: WellPlaceClient, id: string) {
  const { data, error } = await client.rpc("reception_booking_activity", { p_id: id });
  if (error) {
    console.error("[db] booking history failed:", error.message);
    return { ok: false as const, message: "The booking history could not be loaded. Refresh to try again." };
  }
  return { ok: true as const, events: data };
}

export async function readBookingChangeReasons(client: WellPlaceClient, id: string) {
  const { data, error } = await client.rpc("reception_booking_change_reasons", { p_id: id });
  if (error) {
    console.error("[db] booking change reasons failed:", error.message);
    return { ok: false as const, message: "Booking change reasons could not be loaded. Try again." };
  }
  return { ok: true as const, events: data };
}
