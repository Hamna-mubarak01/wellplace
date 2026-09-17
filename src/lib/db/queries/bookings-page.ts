import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type LedgerPaymentStatus = Database["public"]["Enums"]["payment_status"];

const PAYMENT_STATUSES = [
  "open",
  "pending",
  "paid",
  "partially_refunded",
  "fully_refunded",
  "failed",
  "cancelled",
  "manual_review",
] as const satisfies readonly LedgerPaymentStatus[];

export interface BookingLedger {
  paymentStatus: LedgerPaymentStatus;
  paidFils: number;
  refundedFils: number | null;
  refundsPendingFils: number | null;
  createdByName: string | null;
  blockedTo: string | null;
}

export type BookingLedgerRead = { ok: true; ledger: BookingLedger } | { ok: false; message: string };

const LEDGER_UNAVAILABLE = "The payment totals for this booking could not be loaded. Refresh the page to try again.";

const ledgerSchema = z.object({
  payment_status: z.enum(PAYMENT_STATUSES).nullable(),
  paid_fils: z.number().int().nullable(),
  refunded_fils: z.number().int().nullable(),
  refunds_pending_fils: z.number().int().nullable(),
  created_by_name: z.string().nullable(),
  blocked_to: z.string().nullable(),
});

export async function readBookingLedger(client: WellPlaceClient, bookingId: string): Promise<BookingLedgerRead> {
  const { data, error } = await client
    .from("booking_detail")
    .select("payment_status, paid_fils, refunded_fils, refunds_pending_fils, created_by_name, blocked_to")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) {
    console.error("[db] readBookingLedger failed:", error.message);
    return { ok: false, message: LEDGER_UNAVAILABLE };
  }
  if (data === null) return { ok: false, message: LEDGER_UNAVAILABLE };

  const parsed = ledgerSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[db] readBookingLedger returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: LEDGER_UNAVAILABLE };
  }

  return {
    ok: true,
    ledger: {
      paymentStatus: parsed.data.payment_status ?? "open",
      paidFils: parsed.data.paid_fils ?? 0,
      refundedFils: parsed.data.refunded_fils,
      refundsPendingFils: parsed.data.refunds_pending_fils,
      createdByName: parsed.data.created_by_name,
      blockedTo: parsed.data.blocked_to,
    },
  };
}

export interface BookingRefundRecord {
  id: string;
  paymentId: string;
  amountFils: number;
  taxFils: number;
  reason: string | null;
  isPending: boolean;
  isAutomatic: boolean;
  requestedAt: string;
  settledAt: string | null;
  withdrawnAt: string | null;
  reference?: string;
}

export type BookingRefundListing = { ok: true; refunds: BookingRefundRecord[] } | { ok: false; message: string };

const REFUNDS_UNAVAILABLE = "The refunds for this booking could not be loaded. Refresh the page to try again.";

const refundRowSchema = z.object({
  refund_id: z.uuid(),
  payment_id: z.uuid(),
  amount_fils: z.number().int().nonnegative(),
  tax_fils: z.number().int().nonnegative().nullable(),
  reason: z.string().nullable(),
  is_pending: z.boolean(),
  is_automatic: z.boolean(),
  requested_at: z.string(),
  settled_at: z.string().nullable(),
  withdrawn_at: z.string().nullable(),
  reference: z.string(),
});

export async function listBookingRefundRecords(
  client: WellPlaceClient,
  bookingId: string,
): Promise<BookingRefundListing> {
  const { data, error } = await client.rpc("booking_refunds", { p_booking_id: bookingId });
  if (error) {
    console.error("[db] booking_refunds failed:", error.code);
    return { ok: false, message: REFUNDS_UNAVAILABLE };
  }

  const parsed = z.array(refundRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] booking_refunds returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: REFUNDS_UNAVAILABLE };
  }

  return {
    ok: true,
    refunds: parsed.data
      .map((row) => ({
        id: row.refund_id,
        paymentId: row.payment_id,
        amountFils: row.amount_fils,
        taxFils: row.tax_fils ?? 0,
        reason: row.reason,
        isPending: row.is_pending,
        isAutomatic: row.is_automatic,
        requestedAt: row.requested_at,
        settledAt: row.settled_at,
        withdrawnAt: row.withdrawn_at,
        reference: row.reference,
      }))
      .toSorted((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)),
  };
}

export type SuiteNextClaim = { ok: true; nextClaimAt: string | null } | { ok: false; message: string };

const NEXT_CLAIM_UNAVAILABLE = "The suite schedule could not be checked. Try again in a moment.";

export async function readSuiteNextClaim(
  client: WellPlaceClient,
  input: { suiteId: string; bookingId: string; startsAt: string },
): Promise<SuiteNextClaim> {
  const { data, error } = await client
    .from("reception_board")
    .select("experience_from")
    .eq("suite_id", input.suiteId)
    .gte("experience_from", input.startsAt)
    .or(`booking_id.is.null,booking_id.neq.${input.bookingId}`)
    .order("experience_from", { ascending: true })
    .limit(1);

  if (error) {
    console.error("[db] readSuiteNextClaim failed:", error.message);
    return { ok: false, message: NEXT_CLAIM_UNAVAILABLE };
  }

  const parsed = z.array(z.object({ experience_from: z.string().nullable() })).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[db] readSuiteNextClaim returned an unexpected row:", parsed.error.issues[0]?.message);
    return { ok: false, message: NEXT_CLAIM_UNAVAILABLE };
  }

  return { ok: true, nextClaimAt: parsed.data[0]?.experience_from ?? null };
}
