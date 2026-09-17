import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";
import { orSearch, pageWindow, RANGE_NOT_SATISFIABLE, type PageRequest, type Paged } from "@/lib/db/queries/paging";

export type RefundPaymentMethod = Database["public"]["Enums"]["payment_method"];

export const REFUND_STATES = ["pending", "returned", "withdrawn"] as const;
export type RefundState = (typeof REFUND_STATES)[number];
export const REFUND_ORIGINS = ["automatic", "staff"] as const;
export type RefundOrigin = (typeof REFUND_ORIGINS)[number];

export interface RefundLedgerRow {
  id: string;
  paymentId: string;
  bookingId: string;
  bookingReference: string;
  suiteId: string | null;
  suiteNumber: number | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: RefundPaymentMethod;
  isSimulated: boolean;
  amountFils: number;
  taxFils: number;
  state: RefundState;
  isAutomatic: boolean;
  reason: string;
  requestedAt: string;
  requestedByName: string | null;
  settledAt: string | null;
  providerReference: string | null;
  withdrawnAt: string | null;
  withdrawnByName: string | null;
  withdrawalReason: string | null;
  reference: string;
}

export interface RefundLedgerQuery extends PageRequest {
  readonly search?: string;
  readonly states?: readonly RefundState[];
  readonly origin?: RefundOrigin;
  readonly bookingId?: string;
  readonly customerId?: string;
  readonly from?: string;
  readonly to?: string;
}

const refundRowSchema = z.object({
  refund_id: z.uuid(),
  payment_id: z.uuid(),
  booking_id: z.uuid(),
  booking_reference: z.string(),
  suite_id: z.uuid().nullable(),
  suite_number: z.number().int().nullable(),
  customer_id: z.uuid(),
  customer_name: z.string(),
  customer_email: z.string(),
  payment_method: z.enum(["cash", "card_terminal", "payment_link", "online", "complimentary"]),
  is_simulated: z.boolean(),
  amount_fils: z.number().int(),
  tax_fils: z.number().int(),
  state: z.enum(REFUND_STATES),
  is_automatic: z.boolean(),
  reason: z.string(),
  requested_at: z.string(),
  requested_by_name: z.string().nullable(),
  settled_at: z.string().nullable(),
  provider_reference: z.string().nullable(),
  withdrawn_at: z.string().nullable(),
  withdrawn_by_name: z.string().nullable(),
  withdrawal_reason: z.string().nullable(),
  reference: z.string(),
});

const REFUND_COLUMNS =
  "refund_id, payment_id, booking_id, booking_reference, suite_id, suite_number, customer_id, customer_name, customer_email, payment_method, is_simulated, amount_fils, tax_fils, state, is_automatic, reason, requested_at, requested_by_name, settled_at, provider_reference, withdrawn_at, withdrawn_by_name, withdrawal_reason, reference";

const REFUNDS_UNAVAILABLE = "Refunds could not be loaded. Refresh the page to try again.";

export async function listRefundLedger(
  client: WellPlaceClient,
  query: RefundLedgerQuery,
): Promise<Paged<RefundLedgerRow>> {
  const window = pageWindow(query);
  let builder = client
    .from("management_refund_ledger")
    .select(REFUND_COLUMNS, { count: "exact" })
    .order("requested_at", { ascending: false })
    .order("refund_id", { ascending: true })
    .range(window.from, window.to);

  if (query.states && query.states.length > 0) builder = builder.in("state", [...query.states]);
  if (query.origin) builder = builder.eq("is_automatic", query.origin === "automatic");
  if (query.bookingId) builder = builder.eq("booking_id", query.bookingId);
  if (query.customerId) builder = builder.eq("customer_id", query.customerId);
  if (query.from) builder = builder.gte("requested_at", query.from);
  if (query.to) builder = builder.lt("requested_at", query.to);

  const search = orSearch(["booking_reference", "customer_name", "customer_email", "reason", "provider_reference", "reference"], query.search);
  if (search !== null) builder = builder.or(search);

  const { data, error, count } = await builder;

  if (error?.code === RANGE_NOT_SATISFIABLE && window.page > 1) {
    return listRefundLedger(client, { ...query, page: 1 });
  }
  if (error) {
    console.error("[db] listRefundLedger failed:", error.message);
    return { ok: false, message: REFUNDS_UNAVAILABLE };
  }

  const parsed = z.array(refundRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] listRefundLedger returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: REFUNDS_UNAVAILABLE };
  }

  return {
    ok: true,
    rows: parsed.data.map((row) => ({
      id: row.refund_id,
      paymentId: row.payment_id,
      bookingId: row.booking_id,
      bookingReference: row.booking_reference,
      suiteId: row.suite_id,
      suiteNumber: row.suite_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      paymentMethod: row.payment_method,
      isSimulated: row.is_simulated,
      amountFils: row.amount_fils,
      taxFils: row.tax_fils,
      state: row.state,
      isAutomatic: row.is_automatic,
      reason: row.reason,
      requestedAt: row.requested_at,
      requestedByName: row.requested_by_name,
      settledAt: row.settled_at,
      providerReference: row.provider_reference,
      withdrawnAt: row.withdrawn_at,
      withdrawnByName: row.withdrawn_by_name,
      withdrawalReason: row.withdrawal_reason,
      reference: row.reference,
    })),
    total: count ?? parsed.data.length,
    page: window.page,
    pageSize: window.pageSize,
  };
}
