import { NextResponse, type NextRequest } from "next/server";

import { requireManagement } from "@/lib/auth/session";
import {
  filterStaff,
  hasStaffFilters,
  parseStaffAccessFilter,
  parseStaffRoleFilter,
} from "@/lib/console/staff-filters";
import {
  EXPORT_CONTENT_TYPES,
  parseExportFormat,
} from "@/lib/console/export-format";
import {
  staffCsv,
  staffCsvFilename,
  staffXlsxFilename,
} from "@/lib/console/staff-csv";
import { staffXlsx } from "@/lib/console/staff-xlsx";
import { listStaff } from "@/lib/db/queries/staff";
import { createClient } from "@/lib/db/server";

export async function GET(request: NextRequest) {
  await requireManagement();

  const params = request.nextUrl.searchParams;
  const format = parseExportFormat(params.get("format"));
  const filters = {
    search: params.get("q")?.trim() ?? "",
    role: parseStaffRoleFilter(params.get("role") ?? undefined),
    access: parseStaffAccessFilter(params.get("access") ?? undefined),
  };

  const supabase = await createClient();
  const listing = await listStaff(supabase);
  if (!listing.ok) return NextResponse.json({ message: listing.message }, { status: 503 });
  const members = filterStaff(listing.items, filters);
  const scope = hasStaffFilters(filters) ? "filtered" : "all";
  const now = new Date();
  const body = format === "xlsx" ? await staffXlsx(members) : staffCsv(members);
  const filename =
    format === "xlsx"
      ? staffXlsxFilename(now, scope)
      : staffCsvFilename(now, scope);

  return new NextResponse(body, {
    headers: {
      "content-type": EXPORT_CONTENT_TYPES[format],
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
