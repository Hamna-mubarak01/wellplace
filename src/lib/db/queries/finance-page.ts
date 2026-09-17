import { z } from "zod";
import { CLOSED_BOOKING_STATUSES, FINANCE_SUMMARY_READ } from "@/lib/config/finance";
import type { WellPlaceClient } from "@/lib/db/types";

export interface FinanceWindow {
  readonly from: string;
  readonly to: string;
}

export interface FinanceSummaryWindows {
  readonly today: FinanceWindow;
  readonly month: FinanceWindow;
}

export type FinanceRead<T> = { ok: true; value: T } | { ok: false; message: string };

export interface PaymentSummary {
  readonly todayCount: number;
  readonly todayFils: number;
  readonly monthCount: number;
  readonly monthFils: number;
  readonly awaitingCount: number;
  readonly awaitingFils: number;
}

export interface RefundSummary {
  readonly pendingCount: number;
  readonly pendingFils: number;
  readonly automaticPendingCount: number;
  readonly automaticPendingFils: number;
  readonly returnedMonthCount: number;
  readonly returnedMonthFils: number;
  readonly withdrawnCount: number;
  readonly withdrawnFils: number;
}

export interface InvoiceMonthSummary {
  readonly issuedMonthCount: number;
  readonly issuedMonthTotalFils: number;
  readonly issuedMonthTaxFils: number;
  readonly voidedCount: number;
}

const RECEIVED_STATUSES = ["paid", "partially_refunded", "fully_refunded"] as const;
const AWAITING_STATUSES = ["open", "pending"] as const;

const amountRow = z.object({ amount_fils: z.number().int() });
const awaitingRow = z.object({ amount_fils: z.number().int(), booking_id: z.uuid() });
const bookingStatusRow = z.object({ id: z.uuid(), status: z.string() });
const pendingRefundRow = z.object({ amount_fils: z.number().int(), is_automatic: z.boolean() });
const invoiceTotalsRow = z.object({ total_fils: z.number().int(), tax_fils: z.number().int() });

type ChunkResponse = { data: unknown; error: { message: string } | null };

const SUMMARY_UNAVAILABLE = "The totals could not be loaded. Refresh the page to try again.";

async function readChunks<T>(
  label: string,
  schema: z.ZodType<T>,
  fetchChunk: (from: number, to: number) => PromiseLike<ChunkResponse>,
): Promise<T[] | null> {
  const rows: T[] = [];
  const size = FINANCE_SUMMARY_READ.chunkSize;

  for (let chunk = 0; chunk < FINANCE_SUMMARY_READ.maxChunks; chunk += 1) {
    const start = chunk * size;
    const { data, error } = await fetchChunk(start, start + size - 1);
    if (error) {
      console.error(`[db] ${label} failed:`, error.message);
      return null;
    }
    const parsed = z.array(schema).safeParse(data ?? []);
    if (!parsed.success) {
      console.error(`[db] ${label} returned an unexpected row:`, parsed.error.issues[0]?.message);
      return null;
    }
    rows.push(...parsed.data);
    if (parsed.data.length < size) return rows;
  }

  console.error(`[db] ${label} reached its read limit, so no total is shown rather than a partial one.`);
  return null;
}

function sumOf<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

async function readClosedBookingIds(client: WellPlaceClient, bookingIds: readonly string[]): Promise<Set<string> | null> {
  const closed = new Set<string>();
  const size = FINANCE_SUMMARY_READ.lookupChunkSize;
  for (let start = 0; start < bookingIds.length; start += size) {
    const { data, error } = await client
      .from("bookings")
      .select("id,status")
      .in("id", bookingIds.slice(start, start + size))
      .in("status", [...CLOSED_BOOKING_STATUSES]);
    if (error) {
      console.error("[db] payment summary (booking status) failed:", error.message);
      return null;
    }
    const parsed = z.array(bookingStatusRow).safeParse(data ?? []);
    if (!parsed.success) {
      console.error("[db] payment summary (booking status) returned an unexpected row:", parsed.error.issues[0]?.message);
      return null;
    }
    for (const row of parsed.data) closed.add(row.id);
  }
  return closed;
}

export async function readPaymentSummary(
  client: WellPlaceClient,
  windows: FinanceSummaryWindows,
): Promise<FinanceRead<PaymentSummary>> {
  const received = (window: FinanceWindow) => (from: number, to: number) =>
    client
      .from("management_payment_ledger")
      .select("amount_fils")
      .in("status", [...RECEIVED_STATUSES])
      .gte("recorded_at", window.from)
      .lt("recorded_at", window.to)
      .order("payment_id", { ascending: true })
      .range(from, to);

  const [today, month, awaiting] = await Promise.all([
    readChunks("payment summary (today)", amountRow, received(windows.today)),
    readChunks("payment summary (month)", amountRow, received(windows.month)),
    readChunks("payment summary (awaiting)", awaitingRow, (from, to) =>
      client
        .from("management_payment_ledger")
        .select("amount_fils,booking_id")
        .in("status", [...AWAITING_STATUSES])
        .order("payment_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (today === null || month === null || awaiting === null) return { ok: false, message: SUMMARY_UNAVAILABLE };

  const closed = await readClosedBookingIds(client, [...new Set(awaiting.map((row) => row.booking_id))]);
  if (closed === null) return { ok: false, message: SUMMARY_UNAVAILABLE };
  const stillOwed = awaiting.filter((row) => !closed.has(row.booking_id));

  return {
    ok: true,
    value: {
      todayCount: today.length,
      todayFils: sumOf(today, (row) => row.amount_fils),
      monthCount: month.length,
      monthFils: sumOf(month, (row) => row.amount_fils),
      awaitingCount: stillOwed.length,
      awaitingFils: sumOf(stillOwed, (row) => row.amount_fils),
    },
  };
}

export async function readRefundSummary(
  client: WellPlaceClient,
  windows: FinanceSummaryWindows,
): Promise<FinanceRead<RefundSummary>> {
  const [pending, returned, withdrawn] = await Promise.all([
    readChunks("refund summary (pending)", pendingRefundRow, (from, to) =>
      client
        .from("management_refund_ledger")
        .select("amount_fils, is_automatic")
        .eq("state", "pending")
        .order("refund_id", { ascending: true })
        .range(from, to),
    ),
    readChunks("refund summary (returned)", amountRow, (from, to) =>
      client
        .from("management_refund_ledger")
        .select("amount_fils")
        .eq("state", "returned")
        .gte("settled_at", windows.month.from)
        .lt("settled_at", windows.month.to)
        .order("refund_id", { ascending: true })
        .range(from, to),
    ),
    readChunks("refund summary (withdrawn)", amountRow, (from, to) =>
      client
        .from("management_refund_ledger")
        .select("amount_fils")
        .eq("state", "withdrawn")
        .order("refund_id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (pending === null || returned === null || withdrawn === null) return { ok: false, message: SUMMARY_UNAVAILABLE };

  const automatic = pending.filter((row) => row.is_automatic);

  return {
    ok: true,
    value: {
      pendingCount: pending.length,
      pendingFils: sumOf(pending, (row) => row.amount_fils),
      automaticPendingCount: automatic.length,
      automaticPendingFils: sumOf(automatic, (row) => row.amount_fils),
      returnedMonthCount: returned.length,
      returnedMonthFils: sumOf(returned, (row) => row.amount_fils),
      withdrawnCount: withdrawn.length,
      withdrawnFils: sumOf(withdrawn, (row) => row.amount_fils),
    },
  };
}

export async function readInvoiceMonthSummary(
  client: WellPlaceClient,
  windows: FinanceSummaryWindows,
): Promise<FinanceRead<InvoiceMonthSummary>> {
  const [issued, voided] = await Promise.all([
    readChunks("invoice summary (month)", invoiceTotalsRow, (from, to) =>
      client
        .from("management_invoices")
        .select("total_fils, tax_fils")
        .eq("state", "issued")
        .gte("issued_at", windows.month.from)
        .lt("issued_at", windows.month.to)
        .order("sequence_no", { ascending: true })
        .range(from, to),
    ),
    client.from("management_invoices").select("id", { count: "exact", head: true }).eq("state", "voided"),
  ]);

  if (voided.error) console.error("[db] invoice summary (voided) failed:", voided.error.message);
  if (issued === null || voided.error) return { ok: false, message: SUMMARY_UNAVAILABLE };

  return {
    ok: true,
    value: {
      issuedMonthCount: issued.length,
      issuedMonthTotalFils: sumOf(issued, (row) => row.total_fils),
      issuedMonthTaxFils: sumOf(issued, (row) => row.tax_fils),
      voidedCount: voided.count ?? 0,
    },
  };
}
