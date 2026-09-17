import { z } from "zod";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";
import { listManagementBookings, type ManagementBookingRow } from "@/lib/db/queries/management-bookings";
import { listPaymentLedger, type PaymentLedgerRow } from "@/lib/db/queries/management-payments";
import { listInvoices, type InvoiceSummary } from "@/lib/db/queries/invoices";
import { orSearch, pageWindow, RANGE_NOT_SATISFIABLE, type PageRequest, type Paged } from "@/lib/db/queries/paging";

export type BookingSource = Database["public"]["Enums"]["booking_source"];

export interface ManagementCustomer {
  id: string;
  salutation: "mr" | "ms" | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
  phoneCountry: string;
  dateOfBirth: string | null;
  createdAt: string;
  lastInteractionAt: string;
  isBlocked: boolean;
  warningNote: string | null;
  internalNote: string | null;
  bookingsCount: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  paidFils: number;
  reference: string;
  isLead: boolean;
}

export const CUSTOMER_FILTERS = ["all", "leads", "customers", "returning", "upcoming", "blocked", "unblocked"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
export const CUSTOMER_SORTS = ["recent", "name", "value"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface ManagementCustomerQuery extends PageRequest {
  readonly search?: string;
  readonly filter?: CustomerFilter;
  readonly sort?: CustomerSort;
}

const customerRowSchema = z.object({
  id: z.uuid(),
  salutation: z.enum(["mr", "ms"]).nullable(),
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),
  email: z.string(),
  phone_e164: z.string(),
  phone_country: z.string(),
  date_of_birth: z.string().nullable(),
  created_at: z.string(),
  last_interaction_at: z.string(),
  is_blocked: z.boolean(),
  warning_note: z.string().nullable(),
  internal_note: z.string().nullable(),
  bookings_count: z.number().int(),
  upcoming_count: z.number().int(),
  completed_count: z.number().int(),
  cancelled_count: z.number().int(),
  first_visit_at: z.string().nullable(),
  last_visit_at: z.string().nullable(),
  next_visit_at: z.string().nullable(),
  paid_fils: z.number().int(),
  reference: z.string(),
  is_lead: z.boolean(),
});

const CUSTOMER_COLUMNS =
  "id, salutation, first_name, last_name, full_name, email, phone_e164, phone_country, date_of_birth, created_at, last_interaction_at, is_blocked, warning_note, internal_note, bookings_count, upcoming_count, completed_count, cancelled_count, first_visit_at, last_visit_at, next_visit_at, paid_fils, reference, is_lead";

const CUSTOMERS_UNAVAILABLE = "Customers could not be loaded. Refresh the page to try again.";

function toCustomer(row: z.infer<typeof customerRowSchema>): ManagementCustomer {
  return {
    id: row.id,
    salutation: row.salutation,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    phoneE164: row.phone_e164,
    phoneCountry: row.phone_country,
    dateOfBirth: row.date_of_birth,
    createdAt: row.created_at,
    lastInteractionAt: row.last_interaction_at,
    isBlocked: row.is_blocked,
    warningNote: row.warning_note,
    internalNote: row.internal_note,
    bookingsCount: row.bookings_count,
    upcomingCount: row.upcoming_count,
    completedCount: row.completed_count,
    cancelledCount: row.cancelled_count,
    firstVisitAt: row.first_visit_at,
    lastVisitAt: row.last_visit_at,
    nextVisitAt: row.next_visit_at,
    paidFils: row.paid_fils,
    reference: row.reference,
    isLead: row.is_lead,
  };
}

export async function listManagementCustomers(
  client: WellPlaceClient,
  query: ManagementCustomerQuery,
): Promise<Paged<ManagementCustomer>> {
  const window = pageWindow(query);
  let builder = client.from("management_customers").select(CUSTOMER_COLUMNS, { count: "exact" });

  if (query.filter === "leads") builder = builder.eq("is_lead", true).eq("is_blocked", false);
  if (query.filter === "customers") builder = builder.eq("is_lead", false).eq("is_blocked", false);
  if (query.filter === "upcoming") builder = builder.eq("is_lead", false).eq("is_blocked", false).gt("upcoming_count", 0);
  if (query.filter === "returning") {
    builder = builder
      .eq("is_lead", false)
      .eq("is_blocked", false)
      .gte("completed_count", MANAGEMENT_LIST.returningCompletedVisits);
  }
  if (query.filter === "blocked") builder = builder.eq("is_blocked", true);
  if (query.filter === "unblocked") builder = builder.eq("is_blocked", false);

  const search = orSearch(["full_name", "email", "phone_e164", "reference"], query.search);
  if (search !== null) builder = builder.or(search);

  const sort = query.sort ?? "recent";
  if (sort === "name") builder = builder.order("last_name", { ascending: true }).order("first_name", { ascending: true });
  if (sort === "value") builder = builder.order("paid_fils", { ascending: false });
  if (sort === "recent") builder = builder.order("last_interaction_at", { ascending: false });

  const { data, error, count } = await builder.order("id", { ascending: true }).range(window.from, window.to);

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listManagementCustomers(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listManagementCustomers failed:", error.message);
    return { ok: false, message: CUSTOMERS_UNAVAILABLE };
  }

  const parsed = z.array(customerRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listManagementCustomers returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: CUSTOMERS_UNAVAILABLE };
  }

  return { ok: true, rows: parsed.data.map(toCustomer), total: count ?? parsed.data.length, page: window.page, pageSize: window.pageSize };
}

export interface AcceptanceDocument {
  kind: "acceptance";
  id: string;
  bookingId: string;
  bookingReference: string;
  acceptedAt: string;
  source: BookingSource;
  documentSlug: string;
  documentVersion: string;
  checkboxText: string;
}

export interface InvoiceDocument {
  kind: "invoice";
  id: string;
  bookingId: string;
  bookingReference: string;
  issuedAt: string;
  invoiceNumber: string;
  state: InvoiceSummary["state"];
  totalFils: number;
  currency: string;
}

export type CustomerDocument = AcceptanceDocument | InvoiceDocument;

export interface ManagementCustomerDetail {
  customer: ManagementCustomer;
  bookings: ManagementBookingRow[];
  bookingsTotal: number;
  payments: PaymentLedgerRow[];
  paymentsTotal: number;
  documents: CustomerDocument[];
  documentsTotal: number;
}

export type ManagementCustomerLookup =
  | { outcome: "found"; detail: ManagementCustomerDetail }
  | { outcome: "not_found" }
  | { outcome: "failed"; message: string };

const acceptanceRowSchema = z.object({
  id: z.uuid(),
  booking_id: z.uuid(),
  accepted_at: z.string(),
  source: z.enum(["online", "walk_in", "telephone", "manual", "complimentary"]),
  document_slug: z.string(),
  document_version: z.string(),
  checkbox_text: z.string(),
  bookings: z.object({ reference: z.string(), customer_id: z.uuid() }),
});

const CUSTOMER_DETAIL_UNAVAILABLE = "The complete customer record could not be loaded. Refresh the page to try again.";

export async function findManagementCustomer(
  client: WellPlaceClient,
  id: string,
  options: { bookingsPage?: number } = {},
): Promise<ManagementCustomerLookup> {
  const { data, error } = await client.from("management_customers").select(CUSTOMER_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] findManagementCustomer failed:", error.message);
    return { outcome: "failed", message: CUSTOMER_DETAIL_UNAVAILABLE };
  }
  if (data === null) return { outcome: "not_found" };
  const customer = customerRowSchema.safeParse(data);
  if (!customer.success) {
    console.error("[db] findManagementCustomer returned an unexpected row:", customer.error.issues[0]?.message);
    return { outcome: "failed", message: CUSTOMER_DETAIL_UNAVAILABLE };
  }

  const [bookings, payments, acceptance, invoices] = await Promise.all([
    listManagementBookings(client, { customerId: id, page: options.bookingsPage ?? 1, pageSize: MANAGEMENT_LIST.customerBookingsPageSize }),
    listPaymentLedger(client, { customerId: id, page: 1, pageSize: MANAGEMENT_LIST.customerPaymentsLimit }),
    client
      .from("acceptance_records")
      .select("id, booking_id, accepted_at, source, document_slug, document_version, checkbox_text, bookings!inner(reference, customer_id)", { count: "exact" })
      .eq("bookings.customer_id", id)
      .order("accepted_at", { ascending: false })
      .range(0, MANAGEMENT_LIST.customerDocumentsLimit - 1),
    listInvoices(client, { customerId: id, type: "invoice", page: 1, pageSize: MANAGEMENT_LIST.customerDocumentsLimit }),
  ]);

  if (!bookings.ok || !payments.ok || !invoices.ok) {
    return { outcome: "failed", message: CUSTOMER_DETAIL_UNAVAILABLE };
  }
  if (acceptance.error) {
    console.error("[db] customer acceptance records failed:", acceptance.error.message);
    return { outcome: "failed", message: CUSTOMER_DETAIL_UNAVAILABLE };
  }
  const accepted = z.array(acceptanceRowSchema).safeParse(acceptance.data ?? []);
  if (!accepted.success) {
    console.error("[db] customer acceptance records returned an unexpected row:", accepted.error.issues[0]?.message);
    return { outcome: "failed", message: CUSTOMER_DETAIL_UNAVAILABLE };
  }

  const documents: CustomerDocument[] = [
    ...invoices.rows.map((invoice): InvoiceDocument => ({
      kind: "invoice",
      id: invoice.id,
      bookingId: invoice.bookingId,
      bookingReference: invoice.bookingReference,
      issuedAt: invoice.issuedAt,
      invoiceNumber: invoice.invoiceNumber,
      state: invoice.state,
      totalFils: invoice.totalFils,
      currency: invoice.currency,
    })),
    ...accepted.data.map((row): AcceptanceDocument => ({
      kind: "acceptance",
      id: row.id,
      bookingId: row.booking_id,
      bookingReference: row.bookings.reference,
      acceptedAt: row.accepted_at,
      source: row.source,
      documentSlug: row.document_slug,
      documentVersion: row.document_version,
      checkboxText: row.checkbox_text,
    })),
  ];

  return {
    outcome: "found",
    detail: {
      customer: toCustomer(customer.data),
      bookings: bookings.rows,
      bookingsTotal: bookings.total,
      payments: payments.rows,
      paymentsTotal: payments.total,
      documents,
      documentsTotal: invoices.total + (acceptance.count ?? accepted.data.length),
    },
  };
}
