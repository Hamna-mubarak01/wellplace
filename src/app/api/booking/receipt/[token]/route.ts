import { z } from "zod";
import { guestReceipt } from "@/lib/db/guest-checkout";
import { receiptSchema } from "@/lib/config/receipt";
import { renderReceiptPdf, receiptPdfFilename } from "@/lib/documents/receipt-pdf";
import { receiptView } from "@/lib/documents/receipt-view";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success)
    return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
  try {
    const raw = await guestReceipt(token);
    if (!raw) return new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
    const receipt = receiptSchema.parse(raw);
    const pdf = await renderReceiptPdf(receiptView(receipt));
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptPdfFilename(receipt.reference)}"`,
      },
    });
  } catch (cause) {
    console.error("[receipt] download failed:", cause instanceof Error ? cause.message : cause);
    return new Response("Your receipt could not be prepared. Please try again, or contact WellPlace.", {
      status: 503,
      headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
