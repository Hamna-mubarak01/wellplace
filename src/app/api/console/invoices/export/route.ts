import { NextResponse, type NextRequest } from "next/server";

import { parseInvoiceListQuery } from "@/app/(console)/manage/finance/invoices/invoice-list-query";
import { taxDocumentsCsv, taxDocumentsCsvFilename } from "@/components/console/manage/finance/tax-documents-csv";
import { requireManagement } from "@/lib/auth/session";
import { listDocumentsForExport } from "@/lib/db/queries/invoices";
import { createClient } from "@/lib/db/server";

const PRIVATE_HEADERS = { "cache-control": "no-store, private", "x-robots-tag": "noindex, nofollow" } as const;

export async function GET(request: NextRequest) {
  await requireManagement();

  const now = new Date();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { request: query } = parseInvoiceListQuery(params, now);

  try {
    const listing = await listDocumentsForExport(await createClient(), query);
    if (!listing.ok) return NextResponse.json({ message: listing.message }, { status: 503, headers: PRIVATE_HEADERS });

    return new NextResponse(taxDocumentsCsv(listing.rows), {
      headers: {
        ...PRIVATE_HEADERS,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${taxDocumentsCsvFilename(now)}"`,
      },
    });
  } catch (cause) {
    console.error("[invoices] export failed:", cause instanceof Error ? cause.message : cause);
    return NextResponse.json(
      { message: "The invoices could not be exported. Refresh the page and try again." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
