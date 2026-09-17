import { z } from "zod";
import { PAYMENT_LIST } from "@/lib/config/payment-list";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";
import { orSearch, pageWindow, RANGE_NOT_SATISFIABLE, type PageRequest, type Paged } from "@/lib/db/queries/paging";

export type LedgerPaymentMethod = Database["public"]["Enums"]["payment_method"];
export type LedgerPaymentStatus = Database["public"]["Enums"]["payment_status"];

const PAYMENT_METHODS = ["cash", "card_terminal", "payment_link", "online", "complimentary"] as const satisfies readonly LedgerPaymentMethod[];
const PAYMENT_STATUSES = ["open", "pending", "paid", "partially_refunded", "fully_refunded", "failed", "cancelled", "manual_review"] as const satisfies readonly LedgerPaymentStatus[];

export interface PaymentLedgerRow {
  id: string;
  bookingId: string;
  bookingReference: string;
  suiteId: string | null;
  suiteNumber: number | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  method: LedgerPaymentMethod;
  status: LedgerPaymentStatus;
  amountFils: number;
  serviceFeeFils: number;
  taxFils: number;
  isSimulated: boolean;
  providerReference: string | null;
  note: string | null;
  recordedAt: string;
  recordedByName: string | null;
  refundRequestedFils: number;
  refundPendingFils: number;
  refundedFils: number;
  refundableFils: number;
  reference?: string;
}

export interface PaymentLedgerQuery extends PageRequest {
  readonly search?: string;
  readonly methods?: readonly LedgerPaymentMethod[];
  readonly statuses?: readonly LedgerPaymentStatus[];
  readonly customerId?: string;
  readonly bookingId?: string;
  readonly from?: string;
  readonly to?: string;
}

const ledgerRowSchema = z.object({
  payment_id: z.uuid(),
  booking_id: z.uuid(),
  booking_reference: z.string(),
  suite_id: z.uuid().nullable(),
  suite_number: z.number().int().nullable(),
  customer_id: z.uuid(),
  customer_name: z.string(),
  customer_email: z.string(),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  amount_fils: z.number().int(),
  service_fee_fils: z.number().int(),
  tax_fils: z.number().int(),
  is_simulated: z.boolean(),
  provider_reference: z.string().nullable(),
  note: z.string().nullable(),
  recorded_at: z.string(),
  recorded_by_name: z.string().nullable(),
  refund_requested_fils: z.number().int(),
  refund_pending_fils: z.number().int(),
  refunded_fils: z.number().int(),
  refundable_fils: z.number().int(),
  reference: z.string(),
});

const LEDGER_COLUMNS =
  "payment_id, booking_id, booking_reference, suite_id, suite_number, customer_id, customer_name, customer_email, method, status, amount_fils, service_fee_fils, tax_fils, is_simulated, provider_reference, note, recorded_at, recorded_by_name, refund_requested_fils, refund_pending_fils, refunded_fils, refundable_fils, reference";

const LEDGER_UNAVAILABLE = "Payment records could not be loaded. Refresh the page to try again.";

export async function listPaymentLedger(
  client: WellPlaceClient,
  query: PaymentLedgerQuery,
): Promise<Paged<PaymentLedgerRow>> {
  const window = pageWindow(query);
  let builder = client
    .from("management_payment_ledger")
    .select(LEDGER_COLUMNS, { count: "exact" })
    .order("recorded_at", { ascending: false })
    .order("payment_id", { ascending: true })
    .range(window.from, window.to);

  if (query.methods && query.methods.length > 0) builder = builder.in("method", [...query.methods]);
  if (query.statuses && query.statuses.length > 0) builder = builder.in("status", [...query.statuses]);
  if (query.customerId) builder = builder.eq("customer_id", query.customerId);
  if (query.bookingId) builder = builder.eq("booking_id", query.bookingId);
  if (query.from) builder = builder.gte("recorded_at", query.from);
  if (query.to) builder = builder.lt("recorded_at", query.to);

  const search = orSearch(["booking_reference", "customer_name", "customer_email", "provider_reference", "reference"], query.search);
  if (search !== null) builder = builder.or(search);

  const { data, error, count } = await builder;

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listPaymentLedger(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listPaymentLedger failed:", error.message);
    return { ok: false, message: LEDGER_UNAVAILABLE };
  }

  const parsed = z.array(ledgerRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listPaymentLedger returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: LEDGER_UNAVAILABLE };
  }

  return {
    ok: true,
    rows: parsed.data.map((row) => ({
      id: row.payment_id,
      bookingId: row.booking_id,
      bookingReference: row.booking_reference,
      suiteId: row.suite_id,
      suiteNumber: row.suite_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      method: row.method,
      status: row.status,
      amountFils: row.amount_fils,
      serviceFeeFils: row.service_fee_fils,
      taxFils: row.tax_fils,
      isSimulated: row.is_simulated,
      providerReference: row.provider_reference,
      note: row.note,
      recordedAt: row.recorded_at,
      recordedByName: row.recorded_by_name,
      refundRequestedFils: row.refund_requested_fils,
      refundPendingFils: row.refund_pending_fils,
      refundedFils: row.refunded_fils,
      refundableFils: row.refundable_fils,
      reference: row.reference,
    })),
    total: count ?? parsed.data.length,
    page: window.page,
    pageSize: window.pageSize,
  };
}

const rowSchema = z.object({
  id: z.string(), booking_id: z.string(), method: z.string(), status: z.string(),
  is_simulated: z.boolean().default(false), amount_fils: z.number(), recorded_at: z.string(),
  bookings: z.object({ reference: z.string() }),
  refunds: z.array(z.object({ id: z.string(), is_simulated: z.boolean().default(false), amount_fils: z.number(), is_pending: z.boolean(), settled_at: z.string().nullable(), withdrawn_at: z.string().nullable() })),
});

export async function readManagementPayments(client: WellPlaceClient, page: number, search: string) {
  let query = client.from("payments")
    .select("id,booking_id,method,status,is_simulated,amount_fils,recorded_at,bookings!inner(reference),refunds(id,amount_fils,is_pending,settled_at,withdrawn_at)", { count: "exact" })
    .order("recorded_at", { ascending: false }).order("id", { ascending: false });
  if (search) query = query.ilike("bookings.reference", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, count } = await query.range((page - 1) * PAYMENT_LIST.pageSize, page * PAYMENT_LIST.pageSize - 1);
  const parsed = z.array(rowSchema).safeParse(data);
  if (error || !parsed.success) {
    console.error("[payments] listing failed:", error ?? parsed.error);
    return { ok: false as const, message: "Payment records could not be loaded. Reload the page before recording a refund." };
  }
  return { ok: true as const, total: count ?? 0, payments: parsed.data.map((row) => {
    const live = row.refunds.filter((refund) => refund.withdrawn_at === null);
    const requestedFils = live.reduce((total, refund) => total + refund.amount_fils, 0);
    return { ...row, refunds: live, reference: row.bookings.reference, requestedFils,
      remainingFils: Math.max(0, row.amount_fils - requestedFils),
      pendingFils: live.filter((refund) => refund.is_pending).reduce((total, refund) => total + refund.amount_fils, 0),
    };
  }) };
}
