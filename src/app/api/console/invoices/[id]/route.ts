import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { findInvoice } from "@/lib/db/queries/invoices";
import { createClient } from "@/lib/db/server";
import { invoicePdfView } from "@/lib/documents/invoice-pdf-view";
import { renderTaxDocumentPdf, taxDocumentPdfFilename } from "@/lib/documents/tax-document-pdf";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return plain("Invoice not found.", 404);

  try {
    const lookup = await findInvoice(await createClient(), id);
    if (lookup.outcome === "not_found") return plain("Invoice not found.", 404);
    if (lookup.outcome === "failed") {
      return plain("The invoice could not be prepared. Refresh the invoice page and try again.", 503);
    }

    const pdf = await renderTaxDocumentPdf(invoicePdfView(lookup.invoice));
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${taxDocumentPdfFilename(lookup.invoice.invoiceNumber)}"`,
      },
    });
  } catch (cause) {
    console.error("[invoices] download failed:", cause instanceof Error ? cause.message : cause);
    return plain("The invoice could not be prepared. Refresh the invoice page and try again.", 503);
  }
}
