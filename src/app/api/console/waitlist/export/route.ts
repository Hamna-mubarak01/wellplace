import { parseWaitlistFilters } from "@/lib/config/waitlist-filters";
import { NextResponse, type NextRequest } from "next/server";

import { requireManagement } from "@/lib/auth/session";
import {
  isLeadSort,
  listWaitlistLeads,
  type LeadSort,
  type WaitlistLead,
} from "@/lib/db/queries/waitlist-leads";
import { parseSalutationFilter } from "@/components/console/leads-filters";
import { createClient } from "@/lib/db/server";
import {
  waitlistCsv,
  waitlistCsvFilename,
  waitlistXlsxFilename,
} from "@/lib/console/waitlist-csv";
import {
  EXPORT_CONTENT_TYPES,
  parseExportFormat,
} from "@/lib/console/export-format";
import { waitlistXlsx } from "@/lib/console/waitlist-xlsx";

const BATCH = 1000;
const MAX_ROWS = 50_000;

export async function GET(request: NextRequest) {
  await requireManagement();

  const params = request.nextUrl.searchParams;
  const format = parseExportFormat(params.get("format"));

  const filters = parseWaitlistFilters(params);
  const { scope } = filters;
  const search = params.get("q")?.trim() ?? "";
  const rawSort = params.get("sort");
  const sort: LeadSort = isLeadSort(rawSort) ? rawSort : "latest";
  const salutation = parseSalutationFilter(params.get("salutation") ?? undefined);

  const supabase = await createClient();

  const rows: WaitlistLead[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const page = await listWaitlistLeads(supabase, {
      ...filters,
      search,
      sort,
      salutation: salutation === "any" ? undefined : salutation,
      limit: BATCH,
      offset,
    });

    if (page.failed) {
      return NextResponse.json(
        { error: "The waitlist could not be read. Nothing was exported." },
        { status: 503 },
      );
    }

    rows.push(...page.rows);

    if (page.rows.length < BATCH) break;
  }

  const now = new Date();
  const body = format === "xlsx" ? await waitlistXlsx(rows) : waitlistCsv(rows);
  const filename =
    format === "xlsx"
      ? waitlistXlsxFilename(now, scope)
      : waitlistCsvFilename(now, scope);

  return new NextResponse(body, {
    headers: {
      "content-type": EXPORT_CONTENT_TYPES[format],
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
