import type { ArrivalFilter } from "@/lib/config/booking-list";
import type { WellPlaceClient } from "@/lib/db/types";
import { RECEPTION_BOOKING_STATUSES } from "@/lib/domain/booking";
import type { Database } from "@/types/database.generated";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingSource = Database["public"]["Enums"]["booking_source"];

export interface BookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  source: BookingSource;
  suiteId: string | null;
  suiteNumber: number | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  startsAt: string;
  endsAt: string;
  arrivedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  adults: number;
  children: number;
  totalFils: number | null;
  isComplimentary: boolean;
}

export interface BookingPage {
  rows: BookingRow[];
  total: number;
}

export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface BookingQuery {
  search?: string;
  status?: BookingStatus;
  source?: BookingSource;
  paymentStatus?: PaymentStatus;
  suiteId?: string;
  withChildren?: boolean;
  from?: string;
  to?: string;
  startsAfter?: string;
  endsBefore?: string;
  arrival?: ArrivalFilter;
  now?: string;
  ascending?: boolean;
  limit: number;
  offset: number;
}

export async function listBookings(
  client: WellPlaceClient,
  query: BookingQuery,
): Promise<BookingPage> {
  let builder = client
    .from("booking_search")
    .select(
      "booking_id, reference, booking_status, source, suite_id, suite_number, experience_from, experience_to, arrived_at, checked_in_at, checked_out_at, is_complimentary, guest_name, email, phone_e164, adults, children, payment_status, payment_reference, total_fils",
      { count: "exact" },
    )
    .order("experience_from", { ascending: query.ascending ?? false })
    .order("booking_id", { ascending: true })
    .range(query.offset, query.offset + query.limit - 1);

  if (query.startsAfter) builder = builder.gte("experience_from", query.startsAfter);
  if (query.endsBefore) builder = builder.lte("experience_to", query.endsBefore);
  if (query.arrival === "expected" || query.arrival === "overdue") {
    builder = builder.eq("booking_status", "confirmed").is("arrived_at", null).is("checked_in_at", null);
    if (query.arrival === "overdue") builder = builder.lt("experience_from", query.now ?? new Date().toISOString());
  }
  if (query.arrival === "arrived") builder = builder.eq("booking_status", "confirmed").not("arrived_at", "is", null).is("checked_in_at", null);
  if (query.arrival === "checked_in") builder = builder.eq("booking_status", "checked_in");
  if (query.arrival === "checked_out") builder = builder.not("checked_out_at", "is", null);
  builder = query.status
    ? builder.eq("booking_status", query.status)
    : builder.in("booking_status", [...RECEPTION_BOOKING_STATUSES]);
  if (query.source) builder = builder.eq("source", query.source);
  if (query.suiteId) builder = builder.eq("suite_id", query.suiteId);
  if (query.paymentStatus) builder = builder.eq("payment_status", query.paymentStatus);

  if (query.withChildren !== undefined) {
    builder = query.withChildren
      ? builder.gt("children", 0)
      : builder.eq("children", 0);
  }

  if (query.from && query.to) {
    builder = builder.lt("experience_from", query.to).gt("experience_to", query.from);
  }

  const term = query.search?.trim() ?? "";
  if (term.length > 0) {
    const escaped = JSON.stringify(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    builder = builder.or(
      [
        `reference.imatch.${escaped}`,
        `guest_name.imatch.${escaped}`,
        `email.imatch.${escaped}`,
        `phone_e164.imatch.${escaped}`,
        `payment_reference.imatch.${escaped}`,
      ].join(","),
    );
  }

  const { data, error, count } = await builder;

  if (error?.code === "PGRST103" && query.offset > 0) {
    return listBookings(client, { ...query, offset: 0 });
  }
  if (error) {
    console.error("[db] listBookings failed:", error.message);
    throw new Error("Bookings could not be loaded. Please try again.");
  }

  const rows: BookingRow[] = [];

  for (const row of data ?? []) {
    if (
      row.booking_id === null ||
      row.reference === null ||
      row.booking_status === null ||
      row.source === null ||
      row.experience_from === null ||
      row.experience_to === null
    ) {
      throw new Error("A booking record could not be read. Please try again.");
    }

    rows.push({
      id: row.booking_id,
      reference: row.reference,
      status: row.booking_status,
      source: row.source,
      suiteId: row.suite_id,
      suiteNumber: row.suite_number,
      guestName: row.guest_name ?? "",
      guestEmail: row.email ?? "",
      guestPhone: row.phone_e164 ?? "",
      startsAt: row.experience_from,
      endsAt: row.experience_to,
      arrivedAt: row.arrived_at,
      checkedInAt: row.checked_in_at,
      checkedOutAt: row.checked_out_at,
      adults: row.adults ?? 0,
      children: row.children ?? 0,
      totalFils: row.total_fils,
      isComplimentary: row.is_complimentary ?? false,
    });
  }

  return { rows, total: count ?? rows.length };
}

export interface BookingGuest {
  kind: "adult" | "child";
  age: number | null;
}

export interface BookingAddonLine {
  name: string;
  quantity: number;
  unitPriceFils: number;
  lineTotalFils: number;
}

export interface BookingAcceptance {
  documentSlug: string;
  documentVersion: string;
  checkboxText: string;
  acceptedAt: string;
}

export interface BookingDetail extends BookingRow {
  customerId: string;
  guests: BookingGuest[];
  addons: BookingAddonLine[];
  acceptance: BookingAcceptance[];
  cleaningBufferMinutes: number;
  personalRequest: string | null;
  internalNote: string | null;
  lateArrivalMinutes: number | null;
  overrunMinutes: number | null;
  overrunFils: number | null;
  subtotalFils: number | null;
  discountFils: number | null;
  addonsFils: number | null;
  serviceFeeFils: number | null;
  taxFils: number | null;
  createdAt: string;
  isBlocked: boolean;
  warningNote: string | null;
  displayStatus?: BookingStatus;
  isAbandoned?: boolean;
}

export type BookingLookup =
  | { outcome: "found"; booking: BookingDetail }
  | { outcome: "not_found" }
  | { outcome: "failed"; message: string };

export async function findBooking(
  client: WellPlaceClient,
  id: string,
): Promise<BookingLookup> {
  const { data, error } = await client
    .from("booking_detail")
    .select(
      "booking_id, reference, booking_status, source, suite_id, suite_number, experience_from, experience_to, cleaning_buffer_minutes, arrived_at, checked_in_at, checked_out_at, late_arrival_minutes, overrun_minutes, overrun_fils, personal_request, internal_note, is_complimentary, created_at, customer_id, guest_name, email, phone_e164, adults, children, child_ages, is_blocked, warning_note, subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, is_abandoned, display_status",
    )
    .eq("booking_id", id)
    .maybeSingle();

  if (error) {
    console.error("[db] findBooking failed:", error.message);
    return { outcome: "failed", message: error.message };
  }
  if (!data) return { outcome: "not_found" };

  if (
    data.booking_id === null ||
    data.reference === null ||
    data.booking_status === null ||
    data.source === null ||
    data.experience_from === null ||
    data.experience_to === null ||
    data.cleaning_buffer_minutes === null
  ) {
    return { outcome: "failed", message: "The booking row could not be read." };
  }

  const [guests, addons, acceptance] = await Promise.all([
    client
      .from("booking_guests")
      .select("kind, age")
      .eq("booking_id", id),
    client
      .from("booking_addons")
      .select("name_snapshot, quantity, unit_price_fils, line_total_fils")
      .eq("booking_id", id),
    client
      .from("acceptance_records")
      .select("document_slug, document_version, checkbox_text, accepted_at")
      .eq("booking_id", id),
  ]);

  if (guests.error || addons.error || acceptance.error) {
    return { outcome: "failed", message: "The complete booking details could not be loaded." };
  }

  return {
    outcome: "found",
    booking: {
      id: data.booking_id,
      reference: data.reference,
      status: data.booking_status,
      source: data.source,
      suiteId: data.suite_id,
      suiteNumber: data.suite_number,
      guestName: data.guest_name ?? "",
      guestEmail: data.email ?? "",
      guestPhone: data.phone_e164 ?? "",
      startsAt: data.experience_from,
      endsAt: data.experience_to,
      arrivedAt: data.arrived_at,
      checkedInAt: data.checked_in_at,
      checkedOutAt: data.checked_out_at,
      adults: data.adults ?? 0,
      children: data.children ?? 0,
      totalFils: data.total_fils,
      isComplimentary: data.is_complimentary ?? false,
      customerId: data.customer_id ?? "",
      guests: (guests.data ?? []).map((row) => ({
        kind: row.kind,
        age: row.age,
      })),
      addons: (addons.data ?? []).map((row) => ({
        name: row.name_snapshot,
        quantity: row.quantity,
        unitPriceFils: row.unit_price_fils,
        lineTotalFils: row.line_total_fils ?? 0,
      })),
      acceptance: (acceptance.data ?? []).map((row) => ({
        documentSlug: row.document_slug,
        documentVersion: row.document_version,
        checkboxText: row.checkbox_text,
        acceptedAt: row.accepted_at,
      })),
      cleaningBufferMinutes: data.cleaning_buffer_minutes,
      personalRequest: data.personal_request,
      internalNote: data.internal_note,
      lateArrivalMinutes: data.late_arrival_minutes,
      overrunMinutes: data.overrun_minutes,
      overrunFils: data.overrun_fils,
      subtotalFils: data.subtotal_fils,
      discountFils: data.discount_fils,
      addonsFils: data.addons_fils,
      serviceFeeFils: data.service_fee_fils,
      taxFils: data.tax_fils,
      createdAt: data.created_at ?? "",
      isBlocked: data.is_blocked ?? false,
      warningNote: data.warning_note,
      displayStatus: data.display_status ?? data.booking_status,
      isAbandoned: data.is_abandoned ?? false,
    },
  };
}

export interface ArrivalRow {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  suiteNumber: number | null;
  startsAt: string;
  adults: number;
  children: number;
  arrivedAt: string | null;
  status: BookingStatus;
}

export type ArrivalListing =
  | { ok: true; arrivals: ArrivalRow[] }
  | { ok: false; message: string };

export async function listArrivals(
  client: WellPlaceClient,
  window: { from: string; to: string },
): Promise<ArrivalListing> {
  const { data, error } = await client
    .from("booking_search")
    .select(
      "booking_id, reference, booking_status, suite_number, experience_from, arrived_at, guest_name, phone_e164, adults, children",
    )
    .in("booking_status", ["confirmed", "checked_in"])
    .lt("experience_from", window.to)
    .gt("experience_to", window.from)
    .order("experience_from", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows: ArrivalRow[] = [];

  for (const row of data ?? []) {
    if (
      row.booking_id === null ||
      row.reference === null ||
      row.booking_status === null ||
      row.experience_from === null
    ) {
      continue;
    }

    rows.push({
      id: row.booking_id,
      reference: row.reference,
      guestName: row.guest_name ?? "",
      guestPhone: row.phone_e164 ?? "",
      suiteNumber: row.suite_number,
      startsAt: row.experience_from,
      adults: row.adults ?? 0,
      children: row.children ?? 0,
      arrivedAt: row.arrived_at,
      status: row.booking_status,
    });
  }

  return { ok: true, arrivals: rows };
}

export interface AddonPrice {
  id: string;
  name: string;
  priceFils: number;
  regularPriceFils: number;
  isActive: boolean;
}

export async function listAddonPrices(
  client: WellPlaceClient,
  ids?: readonly string[],
): Promise<AddonPrice[]> {
  let builder = client
    .from("addons")
    .select("id, name, offer_price_fils, regular_price_fils, is_active")
    .eq("is_active", true);

  if (ids && ids.length > 0) builder = builder.in("id", [...ids]);

  const { data, error } = await builder;

  if (error) {
    console.error("[db] listAddonPrices failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceFils: row.offer_price_fils,
    regularPriceFils: row.regular_price_fils,
    isActive: row.is_active,
  }));
}
