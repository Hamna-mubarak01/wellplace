import { Suspense } from "react";
import { NewBookingAction } from "@/components/console/reception/new-booking-action";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { BOOKING_LIST } from "@/lib/config/booking-list";
import { dayWindow, fullDayWindow, operatingDayInDubai } from "@/lib/services/board-service";
import { toCalendarDate } from "@/lib/domain/time";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";

import { requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listSuites } from "@/lib/db/queries/board";
import { listBookings } from "@/lib/db/queries/bookings";
import {
  ANY,
  isFiltered,
  parseBookingSearch,
} from "@/components/console/reception/booking-filters";
import { ConsolePage } from "@/components/console/console-page";
import { BookingsPagination } from "@/components/console/reception/bookings-pagination";
import { BookingsTable } from "@/components/console/reception/bookings-table";
import { BookingsToolbar } from "@/components/console/reception/bookings-toolbar";
import { ConsoleReadError } from "@/components/shared/console-read-error";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = BOOKING_LIST.pageSize;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireReception();
  const raw = await searchParams;

  const single = (key: string): string | undefined => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const supabase = await createClient();
  const [listing, snapshot] = await Promise.all([listSuites(supabase), loadSettingsSnapshot(supabase)]);

  if (!listing.ok) {
    return (
      <ConsolePage
        title="Bookings"
      >
        <ConsoleReadError
          title="The suites could not be read"
          message={listing.message}
          meaning="The suite filter needs them, so the list is not shown rather than shown wrong."
        />
      </ConsolePage>
    );
  }

  const suites = listing.suites;

  const query = parseBookingSearch(
    {
      q: single("q"),
      status: single("status"),
      payment: single("payment"),
      source: single("source"),
      guests: single("guests"),
      suite: single("suite"),
      page: single("page"),
      period: single("period"), arrival: single("arrival"), from: single("from"), to: single("to"),
    },
    suites.map((suite) => suite.id),
  );

  const now = new Date();
  const todayDate = operatingDayInDubai(snapshot, now);
  const today = dayWindow(snapshot, toCalendarDate(todayDate)).window ?? fullDayWindow(todayDate);
  const databaseQuery = {
    search: query.search,
    status: query.status === ANY ? undefined : query.status,
    source: query.source === ANY ? undefined : query.source,
    paymentStatus:
      query.paymentStatus === ANY ? undefined : query.paymentStatus,
    suiteId: query.suiteId === ANY ? undefined : query.suiteId,
    withChildren:
      query.guestType === ANY ? undefined : query.guestType === "with_children",
    arrival: query.arrival === ANY ? undefined : query.arrival,
    now: now.toISOString(),
    from: query.from ? fullDayWindow(query.from).start : query.period === "today" ? today.start : undefined,
    to: query.to ? fullDayWindow(query.to).end : query.period === "today" ? today.end : undefined,
    ascending: query.period === "today",
    limit: PAGE_SIZE,
    offset: (query.page - 1) * PAGE_SIZE,
  };
  let page = query.page;
  let result;
  try {
    result = await listBookings(supabase, databaseQuery);
    const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    if (query.page > lastPage) {
      page = lastPage;
      result = await listBookings(supabase, { ...databaseQuery, offset: (lastPage - 1) * PAGE_SIZE });
    }
  } catch {
    return <ConsolePage title="Bookings"><BookingsToolbar query={query} suites={suites.map((suite) => ({ id: suite.id, suiteNumber: suite.suiteNumber }))} total={null} /><ConsoleReadError title="Bookings could not be loaded" message="The booking service did not return a complete result." remedy="Refresh to try again. Your filters are preserved." /></ConsolePage>;
  }
  const { rows, total } = result;

  const hrefFor = (page: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && key !== "page") next.set(key, value);
    }
    next.set("page", String(page));
    return `/reception/bookings?${next.toString()}`;
  };

  return (
    <ConsolePage
      title="Bookings"
      className="reception-bookings-page gap-4 [&>header]:items-center"
      actions={<div className="flex flex-wrap items-center gap-2"><Suspense fallback={<Button disabled>New booking</Button>}><NewBookingAction /></Suspense><Button hoverEffect="sweep" asChild variant="outline" size="sm"><Link href={`/reception?view=day&date=${query.from ?? todayDate}`}><CalendarDaysIcon className="size-4" aria-hidden="true" />View schedule</Link></Button></div>}
    >
      <BookingsToolbar
        query={query}
        suites={suites.map((suite) => ({
          id: suite.id,
          suiteNumber: suite.suiteNumber,
        }))}
        total={total}
      />

      <BookingsTable
        rows={rows}
        filtered={isFiltered(query)}
      />

      <BookingsPagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        hrefFor={hrefFor}
      />
    </ConsolePage>
  );
}
