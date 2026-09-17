import { createClient } from "@/lib/db/server";
import { publishedLegalVersion } from "@/lib/db/queries/legal-content";
import { z } from "zod";
import { createAdminClient } from "@/lib/db/admin";
import { parseGuestTaxDocument, type GuestTaxDocument } from "@/lib/db/invoice-record";
import {
  GUEST_FEE_SETTING_KEYS,
  GUEST_HOLD_SETTING_KEYS,
  type GuestHoldResult,
  type GuestStay,
} from "@/lib/config/guest-checkout";
import {
  requireSetting,
  snapshotFromRows,
  type SettingsSnapshot,
} from "@/lib/config";
import type { Json } from "@/types/database.generated";

export class GuestCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestCheckoutError";
  }
}

export async function loadGuestFeeSettings(): Promise<SettingsSnapshot> {
  const { data, error } = await createAdminClient()
    .from("settings_snapshot")
    .select("key,value")
    .in("key", [...GUEST_FEE_SETTING_KEYS]);
  if (error) throw new Error("The payment fee could not be loaded.");
  const rows = z
    .array(z.object({ key: z.string(), value: z.unknown() }))
    .parse(data);
  if (rows.length !== GUEST_FEE_SETTING_KEYS.length)
    throw new Error("The payment fee is not configured.");
  return snapshotFromRows(rows);
}

export async function reserveGuestHold(
  token: string,
  stay: GuestStay,
  settings: SettingsSnapshot,
): Promise<GuestHoldResult> {
  const expected: Record<string, Json> = {};
  for (const key of GUEST_HOLD_SETTING_KEYS)
    expected[key] = z.json().parse(settings[key] ?? null);
  const { data, error } = await createAdminClient().rpc("reserve_guest_hold", {
    p_token: token,
    p_starts_at: stay.startsAt,
    p_duration_hours: stay.durationHours,
    p_buffer_minutes: requireSetting(settings, "cleaning.buffer_minutes"),
    p_hold_minutes: requireSetting(settings, "hold.minutes"),
    p_expected_settings: expected,
  });
  if (error) {
    if (error.code === "WP060" || error.code === "WP061")
      return { ok: false, message: error.message, chooseAnotherTime: true };
    console.error("[booking] hold failed:", error.code);
    return {
      ok: false,
      message: "We could not hold this time. Please try again.",
      chooseAnotherTime: false,
    };
  }
  const expiry = z.iso.datetime({ offset: true }).safeParse(data);
  return expiry.success
    ? { ok: true, expiresAt: expiry.data }
    : {
        ok: false,
        message: "We could not confirm this hold. Please try again.",
        chooseAnotherTime: false,
      };
}

export async function releaseGuestHold(token: string): Promise<void> {
  const { error } = await createAdminClient().rpc("release_guest_hold", {
    p_token: token,
  });
  if (error)
    throw new Error("Your previous time could not be released. Try again.");
}

export async function checkoutRevision(): Promise<string> {
  const { data, error } = await createAdminClient().rpc("checkout_revision");
  if (error || !data) {
    console.error("[booking] price fingerprint unavailable:", error?.code);
    throw new GuestCheckoutError("Prices could not be verified. Please try again.");
  }
  return data;
}

export async function saveCheckoutProgress(
  token: string,
  progress: import("@/lib/config/checkout-flow").CheckoutProgress,
  options?: { captureCustomer?: boolean },
): Promise<void> {
  const { TERMS_ACCEPTANCE } = await import("@/lib/config/consent");
  const { CHECKOUT_FLOW } = await import("@/lib/config/checkout-flow");
  const legalVersion = await publishedLegalVersion(await createClient());
  const consent = TERMS_ACCEPTANCE.documents.map((document_slug) => ({
    document_slug,
    document_version: legalVersion,
    checkbox_text: TERMS_ACCEPTANCE.text,
  }));
  const { error } = await createAdminClient().rpc("save_checkout_progress", {
    p_token: token,
    p_progress: z.json().parse(progress),
    p_consent: consent,
    p_abandoned_minutes: CHECKOUT_FLOW.abandonedMinutes,
    p_capture_customer: options?.captureCustomer ?? false,
  });
  if (error) {
    console.error("[booking] progress could not be saved:", error.code);
    throw new GuestCheckoutError("Your booking progress could not be saved. Please try again.");
  }
}

export async function loadCheckoutProgress(
  token: string,
): Promise<import("@/lib/config/checkout-flow").SavedCheckout | null> {
  const { data, error } = await createAdminClient().rpc(
    "load_checkout_progress",
    { p_token: token },
  );
  if (error) {
    console.error("[booking] saved checkout could not be loaded:", error.code);
    throw new GuestCheckoutError("Your saved booking could not be loaded.");
  }
  if (!data) return null;
  const { checkoutProgressSchema } = await import("@/lib/config/checkout-flow");
  const saved = z
    .object({
      progress: checkoutProgressSchema,
      recovered: z.boolean(),
      receiptToken: z.uuid().nullable(),
      pendingPayment: z
        .object({
          paymentId: z.uuid(),
          amountFils: z.number(),
          currency: z.string(),
          expiresAt: z.string(),
          simulated: z.boolean(),
        })
        .nullable()
        .optional(),
    })
    .parse(data);
  return {
    ...saved.progress,
    recovered: saved.recovered,
    receiptToken: saved.receiptToken,
    pendingPayment: saved.pendingPayment,
  };
}

export async function guestVoucher(token: string | null, code: string) {
  const client = createAdminClient();
  const saved = token ? await loadCheckoutProgress(token) : null;
  let customerId: string | null = null;
  if (saved) {
    const { normaliseEmail } = await import("@/lib/domain/email");
    const { data, error } = await client
      .from("customers")
      .select("id")
      .eq("identity_key", normaliseEmail(saved.identity.email))
      .maybeSingle();
    if (error) {
      console.error("[booking] coupon eligibility lookup failed:", error.code);
      throw new Error("Coupon eligibility could not be checked.");
    }
    customerId = data?.id ?? null;
  }
  const { findVoucher } = await import("@/lib/db/queries/pricing");
  return findVoucher(client, code, customerId);
}

export async function prepareGuestPayment(
  token: string,
  requestId: string,
  quote: import("@/app/(site)/book/quote-types").GuestQuote,
  currency: string,
  progress: import("@/lib/config/checkout-flow").CheckoutProgress,
  simulated: boolean,
) {
  const revision = z.string().min(1).parse(quote.revision);
  const { data, error } = await createAdminClient().rpc(
    "prepare_guest_payment",
    {
      p_token: token,
      p_request_id: requestId,
      p_quote: z.json().parse({ ...quote, progress }),
      p_revision: revision,
      p_currency: currency,
      p_simulated: simulated,
    },
  );
  if (error) {
    console.error("[booking] payment could not be prepared:", error.code);
    throw new GuestCheckoutError(
      error.code.startsWith("WP06")
        ? error.message
        : "Payment could not be started. Your booking has not been charged.",
    );
  }
  return z
    .object({
      paymentId: z.uuid(),
      amountFils: z.number().int().nonnegative(),
      currency: z.string(),
      expiresAt: z.string(),
      simulated: z.boolean(),
    })
    .parse(data);
}

export async function ownedGuestPayment(token: string, paymentId: string) {
  const { data, error } = await createAdminClient().rpc(
    "guest_payment_for_verification",
    { p_token: token, p_payment_id: paymentId },
  );
  if (error) {
    console.error("[booking] payment ownership check failed:", error.code);
    throw new GuestCheckoutError("Your payment could not be loaded.");
  }
  if (data === null) throw new GuestCheckoutError("This payment does not belong to your booking.");
  return z
    .object({
      paymentId: z.uuid(),
      amountFils: z.number().int().nonnegative(),
      currency: z.literal("AED"),
      option: z.enum(["card", "tabby"]),
      simulated: z.literal(true),
    })
    .parse(data);
}

export async function guestReceipt(token: string) {
  const { RECEIPT_LINK } = await import("@/lib/config/receipt");
  const { data, error } = await createAdminClient().rpc("guest_receipt", {
    p_receipt_token: token,
    p_valid_days: RECEIPT_LINK.validDaysAfterVisit,
  });
  if (error) {
    console.error("[receipt] could not be loaded:", error.code);
    throw new Error("Your receipt could not be loaded.");
  }
  return data ?? null;
}

export async function guestDocument(token: string, documentId: string): Promise<GuestTaxDocument | null> {
  const { RECEIPT_LINK } = await import("@/lib/config/receipt");
  const { data, error } = await createAdminClient().rpc("guest_document", {
    p_receipt_token: token,
    p_valid_days: RECEIPT_LINK.validDaysAfterVisit,
    p_document_id: documentId,
  });
  if (error) {
    console.error("[receipt] document could not be loaded:", error.code);
    throw new Error("Your document could not be loaded.");
  }
  if (data === null) return null;
  const document = parseGuestTaxDocument(data);
  if (document === null) throw new Error("Your document could not be loaded.");
  return document;
}
