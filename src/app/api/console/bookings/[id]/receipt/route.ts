import { requireManagement } from "@/lib/auth/session";
import { requireSetting } from "@/lib/config";
import { createClient } from "@/lib/db/server";
import { findBooking } from "@/lib/db/queries/bookings";
import { listBookingRefundRecords } from "@/lib/db/queries/bookings-page";
import { listBookingPayments } from "@/lib/db/queries/payments";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { idSchema } from "@/lib/validation/console-inputs";
import {
  buildBookingReceipt,
  receiptFilename,
  receiptHtml,
} from "@/components/console/manage/bookings/receipt-model";

const PLAIN = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow",
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return new Response("This booking could not be found.", { status: 404, headers: PLAIN });

  const supabase = await createClient();
  const [lookup, snapshot, payments, refunds] = await Promise.all([
    findBooking(supabase, id),
    loadSettingsSnapshot(supabase),
    listBookingPayments(supabase, id),
    listBookingRefundRecords(supabase, id),
  ]);

  if (lookup.outcome === "not_found") return new Response("This booking could not be found.", { status: 404, headers: PLAIN });
  if (lookup.outcome === "failed" || !payments.ok || !refunds.ok) {
    console.error("[manage/receipt] download could not be prepared for booking", id);
    return new Response("The receipt could not be prepared. Reload the booking and try again.", { status: 503, headers: PLAIN });
  }

  const receipt = buildBookingReceipt({
    booking: lookup.booking,
    payments: payments.payments,
    refunds: refunds.refunds,
    taxLabel: requireSetting(snapshot, "tax.label"),
    taxIsIncluded: requireSetting(snapshot, "tax.inclusive"),
    issuedAt: new Date(),
  });

  return new Response(receiptHtml(receipt), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${receiptFilename(receipt.reference)}"`,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
