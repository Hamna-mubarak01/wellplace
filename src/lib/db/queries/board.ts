import { SCHEDULE_READ_PAGE_SIZE } from "@/lib/config/reception-display";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type OccupancyKind = Database["public"]["Enums"]["occupancy_kind"];
export type OccupancyStatus = Database["public"]["Enums"]["occupancy_status"];
export type SuiteStatus = Database["public"]["Enums"]["suite_status"];

export interface SuiteRow {
  id: string;
  suiteNumber: number;
  status: SuiteStatus;
  priority: number;
  internalNote: string | null;
}

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export type BoardState =
  | "hold"
  | "booked"
  | "checked_in"
  | "cleaning"
  | "block"
  | "maintenance"
  | "no_show"
  | "completed";

export interface OccupancyRow {
  id: string;
  suiteId: string;
  kind: OccupancyKind;
  status: OccupancyStatus;
  experienceStart: string;
  experienceEnd: string;
  blockedEnd: string;
  cleaningBufferMinutes: number;
  expiresAt: string | null;
  reason: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  bookingStatus: BookingStatus | null;
  guestName: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  adults?: number;
  children?: number;
  detailsUnavailable?: boolean;
  paymentStatus?: Database["public"]["Enums"]["payment_status"] | null;
  boardState: BoardState;
}

const RANGE = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/;

function toInstant(raw: string): Date {
  return new Date(raw.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
}

export function parseRange(value: string): { start: string; end: string } | null {
  const match = RANGE.exec(value.trim());
  if (match === null) return null;

  const start = toInstant(match[1]);
  const end = toInstant(match[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return { start: start.toISOString(), end: end.toISOString() };
}

export type SuiteListing =
  | { ok: true; suites: SuiteRow[] }
  | { ok: false; message: string };

export async function listSuites(
  client: WellPlaceClient,
  options: { includeRetired?: boolean } = {},
): Promise<SuiteListing> {
  let query = client
    .from("suites")
    .select("id, suite_number, status, priority, internal_note, is_active");
  if (!options.includeRetired) query = query.is("retired_at", null);
  const { data, error } = await query.order("suite_number", { ascending: true });

  if (error) {
    console.error("[db] listSuites failed:", error.message);
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    suites: (data ?? []).map((row) => ({
      id: row.id,
      suiteNumber: row.suite_number,
      status: row.is_active ? row.status : "out_of_service",
      priority: row.priority,
      internalNote: row.internal_note,
    })),
  };
}

export interface OccupancyWindow {
  readonly from: string;
  readonly to: string;
}

export async function listOccupancy(
  client: WellPlaceClient,
  window: OccupancyWindow,
): Promise<OccupancyRow[]> {
  const data: Partial<Database["public"]["Views"]["reception_schedule"]["Row"]>[] = [];
  for (let offset = 0; ; offset += SCHEDULE_READ_PAGE_SIZE) {
    const page = await client.from("reception_schedule")
      .select("occupancy_id, suite_id, kind, experience_from, experience_to, blocked_to, cleaning_buffer_minutes, expires_at, reason, booking_id, booking_reference, booking_status, guest_name, board_state, guest_email, guest_phone, adults, children, payment_status, details_unavailable")
      .lt("experience_from", window.to).gt("blocked_to", window.from)
      .order("experience_from").order("occupancy_id")
      .range(offset, offset + SCHEDULE_READ_PAGE_SIZE - 1);
    if (page.error) {
      console.error("[db] listOccupancy failed:", page.error.message);
      throw new Error("The schedule could not be loaded. Please try again.");
    }
    data.push(...page.data ?? []);
    if ((page.data?.length ?? 0) < SCHEDULE_READ_PAGE_SIZE) break;
  }

  return (data ?? []).map((row) => {
    const raw = row as unknown as {
      occupancy_id: string;
      suite_id: string;
      kind: OccupancyKind;
      experience_from: string;
      experience_to: string;
      blocked_to: string;
      cleaning_buffer_minutes: number;
      expires_at: string | null;
      reason: string | null;
      booking_id: string | null;
      booking_reference: string | null;
      booking_status: BookingStatus | null;
      guest_name: string | null;
      board_state: BoardState;
      guest_email: string | null;
      guest_phone: string | null;
      adults: number | null;
      children: number | null;
      payment_status: Database["public"]["Enums"]["payment_status"] | null;
      details_unavailable: boolean;
    };

    return {
      id: raw.occupancy_id,
      suiteId: raw.suite_id,
      kind: raw.kind,
      status: "active" as OccupancyStatus,
      experienceStart: raw.experience_from,
      experienceEnd: raw.experience_to,
      blockedEnd: raw.blocked_to,
      cleaningBufferMinutes: raw.cleaning_buffer_minutes,
      expiresAt: raw.expires_at,
      reason: raw.reason,
      bookingId: raw.booking_id,
      bookingReference: raw.booking_reference,
      bookingStatus: raw.booking_status,
      guestName: raw.guest_name,
      paymentStatus: raw.payment_status,
      guestEmail: raw.guest_email,
      guestPhone: raw.guest_phone,
      adults: raw.adults ?? undefined,
      children: raw.children ?? undefined,
      detailsUnavailable: raw.details_unavailable,
      boardState: raw.board_state,
    };
  });
}
