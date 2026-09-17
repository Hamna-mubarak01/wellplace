import { z } from "zod";
import type { WellPlaceClient } from "@/lib/db/types";
import type { CouponInput, CouponRow, CouponTemplate } from "@/lib/config/coupons";
import { databaseErrorMessage } from "@/lib/domain/action-errors";
export async function listCoupons(
  client: WellPlaceClient,
): Promise<CouponRow[]> {
  const { data, error } = await client
    .from("promo_codes")
    .select("*,promo_code_addons(addon_id)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[coupons] list failed:", error.code);
    throw new Error("Coupons could not be loaded. Please reload the page.");
  }
  return data.map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
    code: row.code,
    kind: row.kind,
    amountFils: row.amount_fils,
    percent: row.percent === null ? null : Number(row.percent),
    addonIds: row.promo_code_addons.map((addon) => addon.addon_id),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    maxUses: row.max_uses,
    perCustomerLimit: row.per_customer_limit,
    isCombinable: row.is_combinable,
    isActive: row.is_active,
    usedCount: row.used_count,
    batchId: row.batch_id,
    batchName: row.batch_name,
  }));
}
const generatedCouponsSchema = z.array(
  z.object({
    promo_code_id: z.uuid(),
    code: z.string().min(1),
    batch_id: z.uuid(),
  }),
);
function codesFromDetail(details: string | null | undefined): string[] {
  return (details ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}
function generateFailureMessage(error: { code: string; message: string }): string {
  if (error.code === "WP080" || error.code === "WP081" || error.code === "WP067") return error.message;
  if (error.code === "WP046" || error.code === "WP047") return databaseErrorMessage(error);
  if (error.code === "23505")
    return "Another coupon with one of these codes was saved at the same moment. Generate the coupons again.";
  if (error.code === "40P01")
    return "Another manager was changing coupons at the same moment. Nothing was created. Generate the coupons again.";
  return "The coupons could not be generated. Check the codes and the discount details, then try again.";
}
export async function generateCoupons(
  client: WellPlaceClient,
  input: {
    readonly template: CouponTemplate;
    readonly codes: readonly string[];
    readonly batchName: string | null;
    readonly reason: string;
  },
): Promise<
  | { ok: true; batchId: string | null; coupons: { id: string; code: string }[] }
  | { ok: false; message: string; conflicts: string[] }
> {
  const { data, error } = await client.rpc("generate_checkout_coupons", {
    p_template: { ...input.template },
    p_codes: [...input.codes],
    p_batch_name: input.batchName ?? undefined,
    p_reason: input.reason,
  });
  if (error) {
    console.error("[coupons] generate failed:", error.code);
    return {
      ok: false,
      message: generateFailureMessage(error),
      conflicts: error.code === "WP080" || error.code === "WP081" ? codesFromDetail(error.details) : [],
    };
  }
  const rows = generatedCouponsSchema.safeParse(data);
  if (!rows.success) {
    console.error("[coupons] generate returned an unexpected result");
    return {
      ok: false,
      message: "The coupons may have been created, but the result could not be read. Reload the coupon list before generating again.",
      conflicts: [],
    };
  }
  return {
    ok: true,
    batchId: rows.data[0]?.batch_id ?? null,
    coupons: rows.data.map((row) => ({ id: row.promo_code_id, code: row.code })),
  };
}
export async function writeCoupon(client: WellPlaceClient, input: CouponInput & { readonly reason: string }) {
  const { data, error } = await client.rpc("save_checkout_coupon", {
    p_input: { ...input },
    p_expected_updated_at: input.updatedAt ?? undefined,
  });
  if (error) console.error("[coupons] save failed:", error.code);
  if (error)
    return {
      ok: false as const,
      message:
        error.code === "23505"
          ? "This code already exists. Choose another code or edit the existing coupon."
          : error.code.startsWith("WP06")
            ? error.message
            : "The coupon could not be saved. Check the values and try again.",
    };
  return { ok: true as const, id: data };
}
export async function requestPaymentRefund(
  client: WellPlaceClient,
  input: {
    paymentId: string;
    amountFils: number;
    reason: string;
    requestKey: string;
  },
) {
  const { data, error } = await client.rpc("request_payment_refund", {
    p_payment_id: input.paymentId,
    p_amount_fils: input.amountFils,
    p_reason: input.reason,
    p_request_key: input.requestKey,
  });
  if (error) console.error("[refunds] request failed:", error.code);
  return error
    ? {
        ok: false as const,
        message:
          error.code === "WP066"
            ? error.message
            : "The refund could not be recorded. Refresh the booking and try again.",
      }
    : { ok: true as const, refundId: typeof data === "string" ? data : null, bookingCancelled: false };
}

export async function refundPaymentAndCancelBooking(
  client: WellPlaceClient,
  input: {
    paymentId: string;
    amountFils: number;
    reason: string;
    requestKey: string;
  },
) {
  const { data, error } = await client.rpc("refund_payment_and_cancel_booking", {
    p_payment_id: input.paymentId,
    p_amount_fils: input.amountFils,
    p_reason: input.reason,
    p_request_key: input.requestKey,
  });
  if (error) console.error("[refunds] refund and cancel failed:", error.code);
  if (error)
    return {
      ok: false as const,
      message:
        error.code === "WP066"
          ? error.message
          : "The refund could not be recorded. Refresh the booking and try again.",
    };
  const row = Array.isArray(data) ? data[0] : null;
  return {
    ok: true as const,
    refundId: typeof row?.refund_id === "string" ? row.refund_id : null,
    bookingCancelled: row?.booking_cancelled === true,
  };
}
