import { z } from "zod";

import { RECEIPT_COPY } from "@/lib/config/receipt";
import { guestDocument } from "@/lib/db/guest-checkout";
import { renderGuestDocumentPdf } from "@/lib/documents/guest-document-pdf";

const paramsSchema = z.object({ token: z.uuid(), id: z.uuid() });

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return plain(404, "Not found");

  try {
    const document = await guestDocument(parsed.data.token, parsed.data.id);
    if (document === null) return plain(404, "Not found");
    const { filename, pdf } = await renderGuestDocumentPdf(document);
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (cause) {
    console.error("[receipt] tax document download failed:", cause instanceof Error ? cause.message : cause);
    return plain(503, RECEIPT_COPY.documents.downloadFailed);
  }
}
