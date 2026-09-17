import { NextResponse, type NextRequest } from "next/server";

import { requireManagement } from "@/lib/auth/session";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { createClient } from "@/lib/db/server";
import { listSuites } from "@/lib/db/queries/board";
import {
  listManagementBookings,
  type ManagementBookingRow,
} from "@/lib/db/queries/management-bookings";
import {
  isFiltered,
  listRequest,
  parseBookingsQuery,
} from "@/app/(console)/manage/bookings/bookings-view";
import { bookingsCsv, bookingsCsvFilename } from "@/components/console/manage/bookings/bookings-csv";

const EXPORT_UNAVAILABLE = "The bookings could not be exported. Refresh the page and try again.";

export async function GET(request: NextRequest) {
  await requireManagement();

  const supabase = await createClient();
  const suites = await listSuites(supabase, { includeRetired: true });
  if (!suites.ok) return NextResponse.json({ message: EXPORT_UNAVAILABLE }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = parseBookingsQuery(params, suites.suites.map((suite) => suite.id));
  const now = new Date();
  const rows: ManagementBookingRow[] = [];

  for (let page = 1; ; page += 1) {
    const listing = await listManagementBookings(
      supabase,
      listRequest({ ...query, page }, now, MANAGEMENT_LIST.maxPageSize),
    );
    if (!listing.ok) return NextResponse.json({ message: listing.message }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
    if (listing.page !== page) break;
    rows.push(...listing.rows);
    if (listing.rows.length === 0 || rows.length >= listing.total) break;
  }

  return new NextResponse(bookingsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${bookingsCsvFilename(now, isFiltered(query))}"`,
      "cache-control": "no-store, private",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
