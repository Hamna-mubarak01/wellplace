import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { findCreditNote } from "@/lib/db/queries/invoices";
import { createClient } from "@/lib/db/server";
import { renderCreditNotePdf } from "@/lib/documents/credit-note-pdf-view";
import { taxDocumentPdfFilename } from "@/lib/documents/tax-document-pdf";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

const UNAVAILABLE = "The credit note could not be prepared. Refresh the credit note page and try again.";

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return plain("Credit note not found.", 404);

  try {
    const lookup = await findCreditNote(await createClient(), id);
    if (lookup.outcome === "not_found") return plain("Credit note not found.", 404);
    if (lookup.outcome === "failed") return plain(UNAVAILABLE, 503);

    const pdf = await renderCreditNotePdf(lookup.creditNote);
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${taxDocumentPdfFilename(lookup.creditNote.creditNoteNumber)}"`,
      },
    });
  } catch (cause) {
    console.error("[credit notes] download failed:", cause instanceof Error ? cause.message : cause);
    return plain(UNAVAILABLE, 503);
  }
}
