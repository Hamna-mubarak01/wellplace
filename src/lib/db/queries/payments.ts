import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface PaymentRow {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountFils: number;
  isSimulated?: boolean;
  refundableFils?: number | null;
  pendingRefunds?: readonly PendingRefund[];
  serviceFeeFils: number;
  providerReference: string | null;
  note: string | null;
  recordedAt: string;
  recordedByName: string | null;
  reference?: string;
}

export interface PendingRefund {
  id: string;
  amountFils: number;
  requestedAt: string;
  automatic: boolean;
}

const bookingRefundSchema = z.array(
  z.object({
    refund_id: z.uuid(),
    payment_id: z.uuid(),
    amount_fils: z.number().int().nonnegative(),
    is_pending: z.boolean(),
    is_automatic: z.boolean(),
    requested_at: z.string(),
    withdrawn_at: z.string().nullable(),
  }),
);

async function readBookingRefunds(client: WellPlaceClient, bookingId: string) {
  const { data, error } = await client.rpc("booking_refunds", { p_booking_id: bookingId });
  if (error) {
    console.error("[db] booking_refunds failed:", error.code);
    return null;
  }
  const parsed = bookingRefundSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[db] booking_refunds returned an unexpected shape:", parsed.error.issues[0]?.message);
    return null;
  }
  return parsed.data;
}

export async function listBookingPayments(
  client: WellPlaceClient,
  bookingId: string,
  includeRefunds = false,
): Promise<{ ok: true; payments: PaymentRow[] } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("payments")
    .select(
      "id, booking_id, reference, is_simulated, method, status, amount_fils, service_fee_fils, provider_reference, note, recorded_at, staff ( full_name )",
    )
    .eq("booking_id", bookingId)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("[db] listBookingPayments failed:", error.message);
    return { ok: false, message: "Payment records could not be loaded. Reload the booking before recording another payment." };
  }

  const refunds = includeRefunds ? await readBookingRefunds(client, bookingId) : null;

  return { ok: true, payments: (data ?? []).map((row) => {
    const raw = row as unknown as {
      id: string;
      booking_id: string;
      reference: string;
      method: PaymentMethod;
      status: PaymentStatus;
      amount_fils: number;
      is_simulated?: boolean;
      service_fee_fils: number;
      provider_reference: string | null;
      note: string | null;
      recorded_at: string;
      staff: { full_name: string } | null;
    };
    const live = refunds?.filter((refund) => refund.payment_id === raw.id && refund.withdrawn_at === null) ?? null;

    return {
      id: raw.id,
      bookingId: raw.booking_id,
      method: raw.method,
      status: raw.status,
      amountFils: raw.amount_fils,
      isSimulated: raw.is_simulated === true,
      refundableFils: live === null
        ? null
        : Math.max(0, raw.amount_fils - live.reduce((total, refund) => total + refund.amount_fils, 0)),
      pendingRefunds: live === null
        ? []
        : live.filter((refund) => refund.is_pending).map((refund) => ({
            id: refund.refund_id,
            amountFils: refund.amount_fils,
            requestedAt: refund.requested_at,
            automatic: refund.is_automatic,
          })),
      serviceFeeFils: raw.service_fee_fils,
      providerReference: raw.provider_reference,
      note: raw.note,
      recordedAt: raw.recorded_at,
      recordedByName: raw.staff?.full_name ?? null,
      reference: raw.reference,
    };
  }) };
}
