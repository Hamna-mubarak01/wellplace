import { z } from "zod";
import { SUITE_STATUSES } from "@/lib/config/suite-status";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";
import { orSearch, pageWindow, RANGE_NOT_SATISFIABLE, type PageRequest, type Paged } from "@/lib/db/queries/paging";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingSource = Database["public"]["Enums"]["booking_source"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type SuiteStatus = Database["public"]["Enums"]["suite_status"];

const BOOKING_STATUSES = ["draft", "held", "awaiting_payment", "payment_failed", "hold_expired", "awaiting_recovery", "confirmed", "checked_in", "completed", "rescheduled", "cancelled", "no_show", "abandoned"] as const satisfies readonly BookingStatus[];
const BOOKING_SOURCES = ["online", "walk_in", "telephone", "manual", "complimentary"] as const satisfies readonly BookingSource[];
const PAYMENT_STATUSES = ["open", "pending", "paid", "partially_refunded", "fully_refunded", "failed", "cancelled", "manual_review"] as const satisfies readonly PaymentStatus[];

export interface ManagementBookingRow {
  id: string;
  reference: string;
  status: BookingStatus;
  source: BookingSource;
  suiteId: string | null;
  suiteNumber: number | null;
  customerId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  startsAt: string;
  endsAt: string;
  adults: number;
  children: number;
  paymentStatus: PaymentStatus;
  totalFils: number;
  isComplimentary: boolean;
  createdAt: string;
  displayStatus?: BookingStatus;
  isAbandoned?: boolean;
  createdByName?: string | null;
}

export const BOOKING_ORDERS = ["visit", "created"] as const;
export type BookingOrder = (typeof BOOKING_ORDERS)[number];

export interface ManagementBookingQuery extends PageRequest {
  readonly search?: string;
  readonly orderBy?: BookingOrder;
  readonly statuses?: readonly BookingStatus[];
  readonly sources?: readonly BookingSource[];
  readonly suiteId?: string;
  readonly customerId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly oldestFirst?: boolean;
}

const bookingRowSchema = z.object({
  booking_id: z.uuid(),
  reference: z.string(),
  booking_status: z.enum(BOOKING_STATUSES),
  source: z.enum(BOOKING_SOURCES),
  suite_id: z.uuid().nullable(),
  suite_number: z.number().int().nullable(),
  customer_id: z.uuid(),
  guest_name: z.string().nullable(),
  email: z.string().nullable(),
  phone_e164: z.string().nullable(),
  experience_from: z.string(),
  experience_to: z.string(),
  adults: z.number().int().nullable(),
  children: z.number().int().nullable(),
  payment_status: z.enum(PAYMENT_STATUSES).nullable(),
  total_fils: z.number().int().nullable(),
  is_complimentary: z.boolean().nullable(),
  created_at: z.string(),
  is_abandoned: z.boolean(),
  display_status: z.enum(BOOKING_STATUSES),
  created_by_name: z.string().nullable(),
});

const BOOKING_COLUMNS =
  "booking_id, reference, booking_status, source, suite_id, suite_number, customer_id, guest_name, email, phone_e164, experience_from, experience_to, adults, children, payment_status, total_fils, is_complimentary, created_at, is_abandoned, display_status, created_by_name";

const BOOKINGS_UNAVAILABLE = "Bookings could not be loaded. Refresh the page to try again.";

function toBookingRow(row: z.infer<typeof bookingRowSchema>): ManagementBookingRow {
  return {
    id: row.booking_id,
    reference: row.reference,
    status: row.booking_status,
    source: row.source,
    suiteId: row.suite_id,
    suiteNumber: row.suite_number,
    customerId: row.customer_id,
    guestName: row.guest_name ?? "",
    guestEmail: row.email ?? "",
    guestPhone: row.phone_e164 ?? "",
    startsAt: row.experience_from,
    endsAt: row.experience_to,
    adults: row.adults ?? 0,
    children: row.children ?? 0,
    paymentStatus: row.payment_status ?? "open",
    totalFils: row.total_fils ?? 0,
    isComplimentary: row.is_complimentary ?? false,
    createdAt: row.created_at,
    displayStatus: row.display_status,
    isAbandoned: row.is_abandoned,
    createdByName: row.created_by_name,
  };
}

export async function listManagementBookings(
  client: WellPlaceClient,
  query: ManagementBookingQuery,
): Promise<Paged<ManagementBookingRow>> {
  const window = pageWindow(query);
  let builder = client
    .from("booking_search")
    .select(BOOKING_COLUMNS, { count: "exact" })
    .order(query.orderBy === "created" ? "created_at" : "experience_from", { ascending: query.oldestFirst ?? false })
    .order("booking_id", { ascending: true })
    .range(window.from, window.to);

  if (query.statuses && query.statuses.length > 0) builder = builder.in("display_status", [...query.statuses]);
  if (query.sources && query.sources.length > 0) builder = builder.in("source", [...query.sources]);
  if (query.suiteId) builder = builder.eq("suite_id", query.suiteId);
  if (query.customerId) builder = builder.eq("customer_id", query.customerId);
  if (query.to) builder = builder.lt("experience_from", query.to);
  if (query.from) builder = builder.gt("experience_to", query.from);

  const search = orSearch(["reference", "guest_name", "email", "phone_e164", "payment_reference"], query.search);
  if (search !== null) builder = builder.or(search);

  const { data, error, count } = await builder;

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listManagementBookings(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listManagementBookings failed:", error.message);
    return { ok: false, message: BOOKINGS_UNAVAILABLE };
  }

  const parsed = z.array(bookingRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listManagementBookings returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: BOOKINGS_UNAVAILABLE };
  }

  return { ok: true, rows: parsed.data.map(toBookingRow), total: count ?? parsed.data.length, page: window.page, pageSize: window.pageSize };
}

export function listSuiteBookings(
  client: WellPlaceClient,
  suiteId: string,
  query: Omit<ManagementBookingQuery, "suiteId">,
): Promise<Paged<ManagementBookingRow>> {
  return listManagementBookings(client, { ...query, suiteId });
}

export interface BookedDate {
  date: string;
  bookings: number;
}

export type SuiteBookedDates = { ok: true; dates: BookedDate[] } | { ok: false; message: string };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export async function listSuiteBookedDates(
  client: WellPlaceClient,
  suiteId: string,
  month: string,
): Promise<SuiteBookedDates> {
  const match = MONTH.exec(month);
  if (match === null) return { ok: false, message: "Choose a month to see its booked dates." };

  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const from = `${match[1]}-${match[2]}-01`;
  const to = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await client.rpc("suite_booked_dates", { p_suite_id: suiteId, p_from: from, p_to: to });
  if (error) {
    console.error("[db] suite_booked_dates failed:", error.message);
    return { ok: false, message: "Booked dates could not be loaded. Refresh the page to try again." };
  }

  const parsed = z.array(z.object({ booked_on: z.string(), bookings: z.number().int() })).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] suite_booked_dates returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: "Booked dates could not be loaded. Refresh the page to try again." };
  }

  return { ok: true, dates: parsed.data.map((row) => ({ date: row.booked_on, bookings: row.bookings })) };
}

export interface BookingMoveOption {
  suiteId: string;
  suiteNumber: number;
  displayName: string | null;
  status: SuiteStatus;
  isCurrent: boolean;
  isAvailable: boolean;
}

export type BookingMoveOptions = { ok: true; suites: BookingMoveOption[] } | { ok: false; message: string };

export async function readBookingMoveOptions(
  client: WellPlaceClient,
  bookingId: string,
  startsAt?: string,
): Promise<BookingMoveOptions> {
  const { data, error } = await client.rpc("booking_move_options", {
    p_booking_id: bookingId,
    ...(startsAt === undefined ? {} : { p_starts_at: startsAt }),
  });
  if (error) {
    console.error("[db] booking_move_options failed:", error.message);
    return { ok: false, message: "Suite availability could not be loaded. Refresh the booking and try again." };
  }

  const parsed = z.array(z.object({
    suite_id: z.uuid(),
    suite_number: z.number().int(),
    display_name: z.string().nullable(),
    status: z.enum(SUITE_STATUSES),
    is_current: z.boolean(),
    is_available: z.boolean(),
  })).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] booking_move_options returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: "Suite availability could not be loaded. Refresh the booking and try again." };
  }

  return {
    ok: true,
    suites: parsed.data.map((row) => ({
      suiteId: row.suite_id,
      suiteNumber: row.suite_number,
      displayName: row.display_name,
      status: row.status,
      isCurrent: row.is_current,
      isAvailable: row.is_available,
    })),
  };
}
