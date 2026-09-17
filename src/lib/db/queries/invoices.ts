import { z } from "zod";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import type { WellPlaceClient } from "@/lib/db/types";
import {
  INVOICE_STATES,
  TAX_DOCUMENT_TYPES,
  managedCreditNoteRowSchema,
  managedInvoiceRowSchema,
  toManagedCreditNote,
  toManagedInvoice,
  type InvoiceState,
  type ManagedCreditNote,
  type ManagedInvoice,
  type TaxDocumentType,
} from "@/lib/db/invoice-record";
import { orSearch, pageWindow, RANGE_NOT_SATISFIABLE, type PageRequest, type Paged } from "@/lib/db/queries/paging";

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  sequenceNo: number;
  bookingId: string;
  bookingReference: string;
  suiteNumber: number | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  issuedAt: string;
  issuedByName: string | null;
  totalFils: number;
  taxFils: number;
  taxableFils: number;
  paidFils: number;
  currency: string;
  state: InvoiceState;
  voidedAt: string | null;
  voidReason: string | null;
  documentType?: TaxDocumentType;
  customerReference?: string | null;
  billToCompany?: string | null;
  billToTrn?: string | null;
  supplyDate?: string | null;
  isTest?: boolean;
  originalInvoiceId?: string | null;
  originalInvoiceNumber?: string | null;
  refundId?: string | null;
  replacesInvoiceId?: string | null;
}

export interface InvoiceQuery extends PageRequest {
  readonly search?: string;
  readonly state?: InvoiceState;
  readonly type?: TaxDocumentType;
  readonly bookingId?: string;
  readonly customerId?: string;
  readonly invoiceId?: string;
  readonly from?: string;
  readonly to?: string;
}

const summaryRowSchema = z.object({
  document_type: z.enum(TAX_DOCUMENT_TYPES),
  id: z.uuid(),
  number: z.string(),
  sequence_no: z.number().int(),
  booking_id: z.uuid(),
  booking_reference: z.string(),
  suite_number: z.number().int().nullable(),
  customer_id: z.uuid(),
  customer_reference: z.string().nullable(),
  customer_name: z.string(),
  customer_email: z.string(),
  bill_to_company: z.string().nullable(),
  bill_to_trn: z.string().nullable(),
  issued_at: z.string(),
  issued_by_name: z.string().nullable(),
  supply_date: z.string().nullable(),
  taxable_fils: z.number().int(),
  tax_fils: z.number().int(),
  total_fils: z.number().int(),
  paid_fils: z.number().int(),
  currency: z.string(),
  state: z.enum(INVOICE_STATES),
  is_test: z.boolean(),
  voided_at: z.string().nullable(),
  void_reason: z.string().nullable(),
  original_invoice_id: z.uuid().nullable(),
  original_invoice_number: z.string().nullable(),
  refund_id: z.uuid().nullable(),
  replaces_invoice_id: z.uuid().nullable(),
});

const SUMMARY_COLUMNS =
  "document_type, id, number, sequence_no, booking_id, booking_reference, suite_number, customer_id, customer_reference, customer_name, customer_email, bill_to_company, bill_to_trn, issued_at, issued_by_name, supply_date, taxable_fils, tax_fils, total_fils, paid_fils, currency, state, is_test, voided_at, void_reason, original_invoice_id, original_invoice_number, refund_id, replaces_invoice_id";

const FULL_COLUMNS =
  "id, invoice_number, sequence_no, booking_id, booking_reference, suite_id, suite_number, customer_id, customer_name, customer_email, issued_at, issued_by, issued_by_name, issuer, bill_to, lines, tax, subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, taxable_fils, overrun_fils, total_fils, paid_fils, currency, voided_at, voided_by, voided_by_name, void_reason, state, is_test, supply_date, payments, replaces_invoice_id, customer_reference, credited_fils";

const CREDIT_NOTE_COLUMNS =
  "id, credit_note_number, sequence_no, invoice_id, invoice_number, invoice_issued_at, refund_id, booking_id, booking_reference, customer_id, customer_reference, customer_name, customer_email, issued_at, issued_by, issued_by_name, supply_date, issuer, bill_to, tax, lines, refund, reason, amount_fils, tax_fils, taxable_fils, currency, is_test, voided_at, voided_by, voided_by_name, void_reason, state";

const INVOICES_UNAVAILABLE = "Invoices could not be loaded. Refresh the page to try again.";

export async function listInvoices(
  client: WellPlaceClient,
  query: InvoiceQuery,
): Promise<Paged<InvoiceSummary>> {
  const window = pageWindow(query);
  let builder = client
    .from("management_documents")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("issued_at", { ascending: false })
    .order("sequence_no", { ascending: false })
    .range(window.from, window.to);

  if (query.type) builder = builder.eq("document_type", query.type);
  if (query.state) builder = builder.eq("state", query.state);
  if (query.bookingId) builder = builder.eq("booking_id", query.bookingId);
  if (query.customerId) builder = builder.eq("customer_id", query.customerId);
  if (query.invoiceId) builder = builder.eq("original_invoice_id", query.invoiceId);
  if (query.from) builder = builder.gte("issued_at", query.from);
  if (query.to) builder = builder.lt("issued_at", query.to);

  const search = orSearch(
    ["number", "booking_reference", "customer_name", "customer_email", "customer_reference", "original_invoice_number"],
    query.search,
  );
  if (search !== null) builder = builder.or(search);

  const { data, error, count } = await builder;

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listInvoices(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listInvoices failed:", error.message);
    return { ok: false, message: INVOICES_UNAVAILABLE };
  }

  const parsed = z.array(summaryRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listInvoices returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: INVOICES_UNAVAILABLE };
  }

  return {
    ok: true,
    rows: parsed.data.map((row) => ({
      id: row.id,
      invoiceNumber: row.number,
      sequenceNo: row.sequence_no,
      bookingId: row.booking_id,
      bookingReference: row.booking_reference,
      suiteNumber: row.suite_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      issuedAt: row.issued_at,
      issuedByName: row.issued_by_name,
      totalFils: row.total_fils,
      taxFils: row.tax_fils,
      taxableFils: row.taxable_fils,
      paidFils: row.paid_fils,
      currency: row.currency,
      state: row.state,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      documentType: row.document_type,
      customerReference: row.customer_reference,
      billToCompany: row.bill_to_company,
      billToTrn: row.bill_to_trn,
      supplyDate: row.supply_date,
      isTest: row.is_test,
      originalInvoiceId: row.original_invoice_id,
      originalInvoiceNumber: row.original_invoice_number,
      refundId: row.refund_id,
      replacesInvoiceId: row.replaces_invoice_id,
    })),
    total: count ?? parsed.data.length,
    page: window.page,
    pageSize: window.pageSize,
  };
}

export function listBookingInvoices(client: WellPlaceClient, bookingId: string): Promise<Paged<InvoiceSummary>> {
  return listInvoices(client, { bookingId, type: "invoice", page: 1, pageSize: MANAGEMENT_LIST.bookingInvoicesLimit });
}

export function listBookingDocuments(client: WellPlaceClient, bookingId: string): Promise<Paged<InvoiceSummary>> {
  return listInvoices(client, { bookingId, page: 1, pageSize: MANAGEMENT_LIST.bookingInvoicesLimit });
}

export interface TaxDocumentCsvRow {
  documentType: TaxDocumentType;
  number: string;
  issuedAt: string;
  supplyDate: string | null;
  bookingReference: string;
  customerReference: string | null;
  customerName: string;
  billToCompany: string | null;
  billToTrn: string | null;
  taxableFils: number;
  taxFils: number;
  totalFils: number;
  currency: string;
  state: InvoiceState;
  isTest: boolean;
  originalInvoiceNumber: string | null;
  voidReason: string | null;
}

export async function listDocumentsForExport(
  client: WellPlaceClient,
  query: Omit<InvoiceQuery, "page" | "pageSize">,
): Promise<{ ok: true; rows: TaxDocumentCsvRow[] } | { ok: false; message: string }> {
  const pageSize = MANAGEMENT_LIST.maxPageSize;
  const first = await listInvoices(client, { ...query, page: 1, pageSize });
  if (!first.ok) return first;

  const summaries = [...first.rows];
  const pages = Math.ceil(first.total / pageSize);
  for (let page = 2; page <= pages; page += 1) {
    const next = await listInvoices(client, { ...query, page, pageSize });
    if (!next.ok) return next;
    summaries.push(...next.rows);
  }

  return {
    ok: true,
    rows: summaries.map((row) => ({
      documentType: row.documentType ?? "invoice",
      number: row.invoiceNumber,
      issuedAt: row.issuedAt,
      supplyDate: row.supplyDate ?? null,
      bookingReference: row.bookingReference,
      customerReference: row.customerReference ?? null,
      customerName: row.customerName,
      billToCompany: row.billToCompany ?? null,
      billToTrn: row.billToTrn ?? null,
      taxableFils: row.taxableFils,
      taxFils: row.taxFils,
      totalFils: row.totalFils,
      currency: row.currency,
      state: row.state,
      isTest: row.isTest ?? false,
      originalInvoiceNumber: row.originalInvoiceNumber ?? null,
      voidReason: row.voidReason,
    })),
  };
}

export type InvoiceLookup =
  | { outcome: "found"; invoice: ManagedInvoice }
  | { outcome: "not_found" }
  | { outcome: "failed"; message: string };

export async function findInvoice(client: WellPlaceClient, id: string): Promise<InvoiceLookup> {
  const { data, error } = await client.from("management_invoices").select(FULL_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] findInvoice failed:", error.message);
    return { outcome: "failed", message: "This invoice could not be loaded. Refresh the page to try again." };
  }
  if (data === null) return { outcome: "not_found" };
  const parsed = managedInvoiceRowSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[db] findInvoice returned an unexpected row:", parsed.error.issues[0]?.message);
    return { outcome: "failed", message: "This invoice could not be loaded. Refresh the page to try again." };
  }
  return { outcome: "found", invoice: toManagedInvoice(parsed.data) };
}

export type CreditNoteLookup =
  | { outcome: "found"; creditNote: ManagedCreditNote }
  | { outcome: "not_found" }
  | { outcome: "failed"; message: string };

const CREDIT_NOTE_UNAVAILABLE = "This credit note could not be loaded. Refresh the page to try again.";

export async function findCreditNote(client: WellPlaceClient, id: string): Promise<CreditNoteLookup> {
  const { data, error } = await client.from("management_credit_notes").select(CREDIT_NOTE_COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("[db] findCreditNote failed:", error.message);
    return { outcome: "failed", message: CREDIT_NOTE_UNAVAILABLE };
  }
  if (data === null) return { outcome: "not_found" };
  const parsed = managedCreditNoteRowSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[db] findCreditNote returned an unexpected row:", parsed.error.issues[0]?.message);
    return { outcome: "failed", message: CREDIT_NOTE_UNAVAILABLE };
  }
  return { outcome: "found", creditNote: toManagedCreditNote(parsed.data) };
}

export const MISSING_INVOICE_REASONS = ["payment_not_invoiced", "refund_not_credited", "invoice_exceeds_payments"] as const;
export type MissingInvoiceReason = (typeof MISSING_INVOICE_REASONS)[number];

export interface MissingInvoice {
  bookingId: string;
  bookingReference: string;
  bookingStatus: string;
  customerId: string;
  customerReference: string | null;
  customerName: string;
  customerEmail: string;
  dueFils: number;
  receivedFils: number;
  refundedFils: number;
  invoicedFils: number;
  creditedFils: number;
  uncoveredFils: number;
  uncoveredPaymentCount: number;
  uncreditedRefundFils: number;
  reason: MissingInvoiceReason;
  lastPaymentAt: string;
  invoiceExcessFils: number;
}

export interface MissingInvoiceQuery extends PageRequest {
  readonly search?: string;
}

const missingRowSchema = z.object({
  booking_id: z.uuid(),
  booking_reference: z.string(),
  booking_status: z.string(),
  customer_id: z.uuid(),
  customer_reference: z.string().nullable(),
  customer_name: z.string(),
  customer_email: z.string(),
  due_fils: z.number().int(),
  received_fils: z.number().int(),
  refunded_fils: z.number().int(),
  invoiced_fils: z.number().int(),
  credited_fils: z.number().int(),
  uncovered_fils: z.number().int(),
  uncovered_payment_count: z.number().int(),
  uncredited_refund_fils: z.number().int(),
  reason: z.enum(MISSING_INVOICE_REASONS),
  last_payment_at: z.string(),
  invoice_excess_fils: z.number().int(),
});

const MISSING_COLUMNS =
  "booking_id, booking_reference, booking_status, customer_id, customer_reference, customer_name, customer_email, due_fils, received_fils, refunded_fils, invoiced_fils, credited_fils, uncovered_fils, uncovered_payment_count, uncredited_refund_fils, reason, last_payment_at, invoice_excess_fils";

const MISSING_UNAVAILABLE = "Missing invoices could not be loaded. Refresh the page to try again.";

export async function listMissingInvoices(
  client: WellPlaceClient,
  query: MissingInvoiceQuery,
): Promise<Paged<MissingInvoice>> {
  const window = pageWindow(query);
  let builder = client
    .from("management_missing_invoices")
    .select(MISSING_COLUMNS, { count: "exact" })
    .order("last_payment_at", { ascending: false })
    .order("booking_id", { ascending: true })
    .range(window.from, window.to);

  const search = orSearch(["booking_reference", "customer_name", "customer_email", "customer_reference"], query.search);
  if (search !== null) builder = builder.or(search);

  const { data, error, count } = await builder;

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listMissingInvoices(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listMissingInvoices failed:", error.message);
    return { ok: false, message: MISSING_UNAVAILABLE };
  }

  const parsed = z.array(missingRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listMissingInvoices returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: MISSING_UNAVAILABLE };
  }

  return {
    ok: true,
    rows: parsed.data.map((row) => ({
      bookingId: row.booking_id,
      bookingReference: row.booking_reference,
      bookingStatus: row.booking_status,
      customerId: row.customer_id,
      customerReference: row.customer_reference,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      dueFils: row.due_fils,
      receivedFils: row.received_fils,
      refundedFils: row.refunded_fils,
      invoicedFils: row.invoiced_fils,
      creditedFils: row.credited_fils,
      uncoveredFils: row.uncovered_fils,
      uncoveredPaymentCount: row.uncovered_payment_count,
      uncreditedRefundFils: row.uncredited_refund_fils,
      reason: row.reason,
      lastPaymentAt: row.last_payment_at,
      invoiceExcessFils: row.invoice_excess_fils,
    })),
    total: count ?? parsed.data.length,
    page: window.page,
    pageSize: window.pageSize,
  };
}
